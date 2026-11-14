// @ts-check
// Member-count relay (docs/contracts/members-json.md 2.11, deploy.md section 13, ADR-0005). One file, no dependency.
// A timer calls the Discord invite endpoint from the VPS; one path serves a four-field projection of the last good
// answer. Nothing a request does can cause a Discord call, a failed fetch never ends the process, and the only output
// is one line of fixed vocabulary per scheduled fetch (D-20: no access log, never upstream text).
import { Buffer } from 'node:buffer';
import http from 'node:http';
import process from 'node:process';
import { setInterval, setTimeout } from 'node:timers';
import { pathToFileURL } from 'node:url';
import { TextDecoder } from 'node:util';

export const SOURCE_PATH = '/data/members-source.json';
export const HEALTH_PATH = '/healthz';
export const PORT = 8080;
export const CYCLE_MS = 6 * 60 * 60 * 1000;
export const RETRY_MS = 10 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 8_000;
export const BODY_CAP_BYTES = 64 * 1024;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const USER_AGENT = 'EmpireCommunitySite-members/1 (+https://empirecommunity.org)';
const CODE_PATTERN = /^[A-Za-z0-9-]{2,32}$/;
const GUILD_ID_PATTERN = /^[0-9]{17,20}$/;
const MAX_MEMBERS = 1_000_000;
const HTTP_TOO_MANY_REQUESTS = 429;
// Settings that would send the call through another host or weaken TLS (K3): the relay refuses to start with any.
const FORBIDDEN_ENV = Object.freeze([
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy',
  'NODE_USE_ENV_PROXY', 'NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_EXTRA_CA_CERTS', 'NODE_OPTIONS',
]);
// Server limits (K4): a flood costs this path only.
const SERVER_OPTIONS = Object.freeze({
  maxHeaderSize: 8 * 1024,
  headersTimeout: 5_000,
  requestTimeout: 10_000,
  keepAliveTimeout: 5_000,
  connectionsCheckingInterval: 1_000,
  requireHostHeader: false, // Node's own 400 for a missing Host would skip the fixed headers; the target alone decides
});
const MAX_CONNECTIONS = 64;
const SOCKET_IDLE_MS = 10_000;

/** Sent on every answer, whatever its status: nothing on this path may ever be usable as a page (2.11). */
export const FIXED_HEADERS = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
});

/** @typedef {{ body: Buffer, fetchedAtMs: number }} Stored */
/** @typedef {{ status: number, headers: Record<string, string>, body: Buffer | null }} Answer */
/**
 * @typedef {{ ok: true, status: number, body: Buffer, fetchedAtMs: number }
 *   | { ok: false, status: number | null, reason: string }} FetchResult
 */
/** @typedef {(url: string, init: RequestInit) => Promise<Response>} FetchImpl */
/**
 * @typedef {{
 *   setTimeout: (callback: () => void, ms: number) => unknown,
 *   setInterval: (callback: () => void, ms: number) => unknown,
 * }} Timers
 */

/**
 * Reads the one setting. Throws with a fixed code on a missing or malformed invite code or a forbidden variable.
 * @param {Record<string, string | undefined>} env
 */
export function readConfig(env) {
  for (const name of FORBIDDEN_ENV) if (env[name] !== undefined) throw new Error(`forbidden_env ${name}`);
  const inviteCode = env['DISCORD_INVITE_CODE'];
  if (inviteCode === undefined || !CODE_PATTERN.test(inviteCode)) throw new Error('invalid_invite_code');
  return { inviteCode };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Builds the served body field by field from an untrusted answer (K1), or returns null when any field fails its
 * check. Discord's object is never copied or spread: the inviter, channel and profile never reach the body.
 * @param {unknown} json
 * @param {string} inviteCode
 * @param {number} fetchedAtMs
 */
export function project(json, inviteCode, fetchedAtMs) {
  if (!isObject(json) || json['code'] !== inviteCode) return null;
  const guild = json['guild'];
  if (!isObject(guild)) return null;
  const guildId = guild['id'];
  if (typeof guildId !== 'string' || !GUILD_ID_PATTERN.test(guildId)) return null;
  const count = json['approximate_member_count'];
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MAX_MEMBERS) return null;
  const served = {
    code: inviteCode,
    guild: { id: guildId },
    approximate_member_count: count,
    fetchedAt: new Date(fetchedAtMs).toISOString(),
  };
  return Buffer.from(JSON.stringify(served), 'utf8');
}

/** @param {unknown} error */
const errorClass = (error) => (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'timeout' : 'network');

/** @param {Response} response */
const discard = (response) => response.body?.cancel().catch(() => undefined);

/**
 * Reads the body with a cap counted while streaming (the decoded bytes, so a compressed answer is capped too).
 * @param {Response} response
 * @returns {Promise<{ ok: true, text: string } | { ok: false, reason: string }>}
 */
async function readCapped(response) {
  if (Number(response.headers.get('content-length')) > BODY_CAP_BYTES) {
    await discard(response);
    return { ok: false, reason: 'oversized' };
  }
  if (response.body === null) return { ok: true, text: '' };
  const reader = response.body.getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let size = 0;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.byteLength;
      if (size > BODY_CAP_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'oversized' };
      }
      chunks.push(chunk.value);
    }
  } catch (error) {
    return { ok: false, reason: errorClass(error) };
  }
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)) };
  } catch {
    return { ok: false, reason: 'not_json' };
  }
}

/**
 * One call to the fixed Discord address (K3). Never throws.
 * @param {{ inviteCode: string, fetchImpl: FetchImpl, now: () => number }} deps
 * @returns {Promise<FetchResult>}
 */
export async function fetchInvite({ inviteCode, fetchImpl, now }) {
  const url = `https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`;
  /** @type {Response} */
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      redirect: 'manual',
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, status: null, reason: errorClass(error) };
  }
  const { status } = response;
  if (status !== 200) {
    await discard(response);
    if (status === HTTP_TOO_MANY_REQUESTS) return { ok: false, status, reason: 'rate_limited' };
    return { ok: false, status, reason: status >= 300 && status < 400 ? 'redirect' : 'http_status' };
  }
  const read = await readCapped(response);
  if (!read.ok) return { ok: false, status, reason: read.reason };
  /** @type {unknown} */
  let json;
  try {
    json = JSON.parse(read.text);
  } catch {
    return { ok: false, status, reason: 'not_json' };
  }
  const fetchedAtMs = now();
  const body = project(json, inviteCode, fetchedAtMs);
  return body === null ? { ok: false, status, reason: 'invalid_answer' } : { ok: true, status, body, fetchedAtMs };
}

/**
 * The one line per scheduled fetch (K9): fixed words and a status code, never upstream text or request data.
 * @param {FetchResult} result
 * @param {boolean} retry
 */
export function logLine(result, retry) {
  const status = result.status ?? 'none';
  if (result.ok) return `members-source fetch outcome=stored status=${status}`;
  return `members-source fetch outcome=kept status=${status} reason=${result.reason} retry=${retry ? 'yes' : 'no'}`;
}

/**
 * @param {number} status
 * @param {Record<string, string>} [extra]
 * @param {Buffer | null} [body]
 * @param {number} [length]
 * @returns {Answer}
 */
const reply = (status, extra = {}, body = null, length = 0) => ({
  status,
  headers: { ...FIXED_HEADERS, ...extra, 'Content-Length': String(length) },
  body,
});

/**
 * The serving table of 2.11. The raw request target must match exactly; nothing from the request is echoed.
 * @param {string} method
 * @param {string} target
 * @param {Stored | null} stored
 * @param {number} nowMs
 * @returns {Answer}
 */
export function answer(method, target, stored, nowMs) {
  if (target === HEALTH_PATH && method === 'GET') return reply(200);
  if (target !== SOURCE_PATH) return reply(404);
  if (method !== 'GET' && method !== 'HEAD') return reply(405, { Allow: 'GET, HEAD' });
  if (stored === null || nowMs - stored.fetchedAtMs > MAX_AGE_MS) return reply(503);
  return reply(200, {}, method === 'GET' ? stored.body : null, stored.body.length);
}

/**
 * Answers a request Node could not parse (no response object exists): an empty body with the fixed headers, then
 * the connection is closed. An oversized header block gets 431, a request timeout 408, anything else 400.
 * @param {unknown} error
 * @param {import('node:stream').Duplex} socket
 */
function answerClientError(error, socket) {
  if (!socket.writable) {
    socket.destroy();
    return;
  }
  const { status, headers } = reply(clientErrorStatus(error));
  const lines = Object.entries({ ...headers, Connection: 'close' }).map(([name, value]) => `${name}: ${value}`);
  socket.end(`HTTP/1.1 ${status} ${http.STATUS_CODES[status] ?? ''}\r\n${lines.join('\r\n')}\r\n\r\n`);
}

/** @param {unknown} error */
function clientErrorStatus(error) {
  const code = isObject(error) ? error['code'] : undefined;
  if (code === 'ERR_HTTP_REQUEST_TIMEOUT') return 408;
  if (code === 'HPE_HEADER_OVERFLOW') return 431;
  return 400;
}

/**
 * The relay: its stored value, the timer-driven fetch and the HTTP server. Time, the Discord call, the timers and the
 * log are injected so the tests use none of the real ones.
 * @param {{ inviteCode: string, fetchImpl: FetchImpl, now: () => number, log: (line: string) => void, timers: Timers }} deps
 */
export function createRelay({ inviteCode, fetchImpl, now, log, timers }) {
  /** @type {Stored | null} */
  let stored = null;
  let inFlight = false;

  /** @param {boolean} isRetry */
  async function runFetch(isRetry) {
    if (inFlight) return;
    inFlight = true;
    try {
      const result = await fetchInvite({ inviteCode, fetchImpl, now });
      if (result.ok) stored = { body: result.body, fetchedAtMs: result.fetchedAtMs };
      // One retry after a failed cycle, none after a 429 (X4) and none after a retry: the next cycle is awaited.
      const retry = !result.ok && !isRetry && result.status !== HTTP_TOO_MANY_REQUESTS;
      if (retry) timers.setTimeout(() => scheduled(true), RETRY_MS);
      log(logLine(result, retry));
    } finally {
      inFlight = false;
    }
  }

  // fetchInvite never throws, so only the log write can: it must not end the process, because a crash loop would
  // turn restarts into Discord calls (K3). There is nowhere left to report it.
  /** @param {boolean} isRetry */
  const scheduled = (isRetry) => runFetch(isRetry).catch(() => undefined);

  /** Starts the timer: one fetch now, then one every cycle. Never called by a request. */
  function start() {
    timers.setInterval(() => scheduled(false), CYCLE_MS);
    return scheduled(false);
  }

  /**
   * The request handler. It reads the method and the raw target only: the body is never read.
   * @param {{ method?: string | undefined, url?: string | undefined }} request
   * @param {http.ServerResponse} response
   */
  function handle(request, response) {
    const out = answer(request.method ?? '', request.url ?? '', stored, now());
    response.writeHead(out.status, out.headers);
    response.end(out.body ?? undefined);
  }

  function createServer() {
    const server = http.createServer(SERVER_OPTIONS, handle);
    server.maxConnections = MAX_CONNECTIONS;
    server.setTimeout(SOCKET_IDLE_MS);
    // Answered at once and with no 100 Continue: the body is never wanted. With no 'upgrade' listener, Node 24 serves
    // an Upgrade request through the handler like any other request (tested).
    server.on('checkContinue', handle);
    server.on('checkExpectation', handle);
    server.on('clientError', answerClientError);
    return server;
  }

  return { start, handle, createServer, runFetch };
}

/** Entry point of the image: exits only on a bad setting at start or on a stop signal. */
function main() {
  let config;
  try {
    config = readConfig(process.env);
  } catch (error) {
    process.stderr.write(`members-source start failed: ${error instanceof Error ? error.message : 'unknown'}\n`);
    process.exit(1);
  }
  const relay = createRelay({
    inviteCode: config.inviteCode,
    fetchImpl: globalThis.fetch,
    now: Date.now,
    log: (line) => process.stdout.write(`${line}\n`),
    timers: { setTimeout, setInterval },
  });
  process.stdout.on('error', () => undefined); // a closed log pipe must not end the process either
  // The timer starts only once the port is bound: a failed bind exits before any Discord call, so restarts cost none.
  relay.createServer().listen(PORT, () => void relay.start());
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => process.exit(0));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main();
