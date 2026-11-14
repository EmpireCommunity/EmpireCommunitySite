// Relay of members-json 2.11 (B-WK1, threat model K1-K4, K9, X4). Time, the Discord call and the timers are
// injected; the server tests use a loopback socket and no outside network.
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import net from 'node:net';
import { test } from 'node:test';
import {
  BODY_CAP_BYTES, CYCLE_MS, FIXED_HEADERS, HEALTH_PATH, MAX_AGE_MS, RETRY_MS, SOURCE_PATH, USER_AGENT,
  answer, createRelay, fetchInvite, project, readConfig,
} from '../deploy/members-source/relay.mjs';

const CODE = 'abc123';
const GUILD_ID = '100000000000000000';
const NOW = Date.parse('2026-11-14T12:00:03.120Z');
// A realistic invite answer: everything but the four fields must vanish (K1).
const INVITE = {
  type: 0,
  code: CODE,
  inviter: { id: '200000000000000000', username: 'inviter-secret-name', avatar: 'avatar-hash-secret', global_name: 'Inviter Secret' },
  expires_at: null,
  guild: {
    id: GUILD_ID, name: 'guild-secret-name', description: 'guild-secret-description', features: ['COMMUNITY'],
    icon: 'icon-hash-secret', vanity_url_code: null, premium_subscription_count: 7, nsfw_level: 0,
  },
  guild_id: GUILD_ID,
  channel: { id: '300000000000000000', type: 0, name: 'channel-secret-name' },
  profile: { id: GUILD_ID, name: 'profile-secret-name', tag: 'TAG', badge: 1, traits: [{ label: 'trait-secret' }] },
  approximate_member_count: 887,
  approximate_presence_count: 123,
};
const SERVED = { code: CODE, guild: { id: GUILD_ID }, approximate_member_count: 887, fetchedAt: '2026-11-14T12:00:03.120Z' };

const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
type Call = { url: string, init: RequestInit };
type Relay = ReturnType<typeof createRelay>;

/** A relay with a scripted Discord, a settable clock, recorded timers and a recorded log. */
function harness(answers: Array<() => Response | Promise<Response>>, clock = { now: NOW }) {
  const calls: Call[] = [];
  const timeouts: Array<{ callback: () => void, ms: number }> = [];
  const intervals: Array<{ callback: () => void, ms: number }> = [];
  const lines: string[] = [];
  const relay = createRelay({
    inviteCode: CODE,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const next = answers.shift();
      if (next === undefined) throw new Error('unexpected Discord call');
      return next();
    },
    now: () => clock.now,
    log: (line) => { lines.push(line); },
    timers: {
      setTimeout: (callback, ms) => { timeouts.push({ callback, ms }); },
      setInterval: (callback, ms) => { intervals.push({ callback, ms }); },
    },
  });
  return { relay, calls, timeouts, intervals, lines };
}

/** Sends one raw HTTP/1.1 request to a relay server on loopback and returns the raw answer once the socket closes. */
async function raw(relay: Relay, request: string) {
  const server = relay.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await new Promise<string>((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1', () => socket.write(request));
      const chunks: Buffer[] = [];
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('end', () => resolve(Buffer.concat(chunks).toString('latin1')));
      socket.on('error', reject);
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
const getSource = (relay: Relay) => raw(relay, `GET ${SOURCE_PATH} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
const statusOf = (rawAnswer: string) => Number(rawAnswer.split(' ', 2)[1]);
const bodyOf = (rawAnswer: string): unknown => JSON.parse(rawAnswer.split('\r\n\r\n')[1]!);
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('the projection keeps exactly the four fields and nothing else of the invite answer (K1)', () => {
  const body = project(INVITE, CODE, NOW);
  assert.ok(body !== null);
  const text = body.toString('utf8');
  assert.deepEqual(JSON.parse(text), SERVED);
  for (const leaked of ['secret', 'inviter', 'channel', 'profile', 'presence', '200000000000000000', '300000000000000000']) assert.ok(!text.includes(leaked), leaked);
});

const invalid: Array<[string, unknown]> = [
  ['another code', { ...INVITE, code: 'other1' }],
  ['a numeric guild id', { ...INVITE, guild: { id: Number(GUILD_ID) } }],
  ['a short guild id', { ...INVITE, guild: { id: '1234' } }],
  ['a guild id with letters', { ...INVITE, guild: { id: '10000000000000000a' } }],
  ['no guild', { ...INVITE, guild: undefined }],
  ['a guild array', { ...INVITE, guild: [GUILD_ID] }],
  ['a count of 0', { ...INVITE, approximate_member_count: 0 }],
  ['a count above 1,000,000', { ...INVITE, approximate_member_count: 1_000_001 }],
  ['a fractional count', { ...INVITE, approximate_member_count: 887.5 }],
  ['a count as text', { ...INVITE, approximate_member_count: '887' }],
  ['an array', [INVITE]],
  ['null', null],
];
for (const [name, value] of invalid) {
  test(`an answer with ${name} does not replace the stored value`, async () => {
    const { relay, lines } = harness([() => json(INVITE), () => json(value)]);
    await relay.runFetch(false);
    await relay.runFetch(true);
    assert.equal(lines[1], 'members-source fetch outcome=kept status=200 reason=invalid_answer retry=no');
    assert.deepEqual(bodyOf(await getSource(relay)), SERVED);
  });
}

test('an invalid first answer serves nothing (503)', async () => {
  const { relay } = harness([() => json({ ...INVITE, code: 'other1' })]);
  await relay.runFetch(false);
  assert.equal(statusOf(await getSource(relay)), 503);
});

const failures: Array<[string, () => Response | Promise<Response>, string]> = [
  ['a 5xx', () => new Response('upstream text 500', { status: 500 }), 'status=500 reason=http_status'],
  ['a 403 page', () => new Response('<html>upstream text</html>', { status: 403 }), 'status=403 reason=http_status'],
  ['a 404', () => new Response('{"message": "Unknown Invite"}', { status: 404 }), 'status=404 reason=http_status'],
  ['a redirect', () => new Response(null, { status: 301, headers: { location: 'https://evil.example/' } }), 'status=301 reason=redirect'],
  ['a streamed body over the cap', () => new Response(`{"a":"${'x'.repeat(BODY_CAP_BYTES)}"}`), 'status=200 reason=oversized'],
  ['a declared length over the cap', () => new Response('{}', { headers: { 'content-length': String(BODY_CAP_BYTES + 1) } }), 'status=200 reason=oversized'],
  ['a non-JSON body', () => new Response('<html>upstream text</html>'), 'status=200 reason=not_json'],
  ['a body that is not UTF-8', () => new Response(new Uint8Array([0x7b, 0xff, 0x7d])), 'status=200 reason=not_json'],
  ['an empty body', () => new Response(null), 'status=200 reason=not_json'],
  ['a timeout', () => Promise.reject(new DOMException('upstream text', 'TimeoutError')), 'status=none reason=timeout'],
  ['a network error', () => Promise.reject(new TypeError('upstream text')), 'status=none reason=network'],
  ['a body that fails mid-stream', () => new Response(new ReadableStream({ pull: (controller) => controller.error(new TypeError('upstream text')) })), 'status=200 reason=network'],
];
for (const [name, failure, logged] of failures) {
  test(`${name} keeps the previous value, logs one fixed line and resolves (no exit)`, async () => {
    const { relay, lines } = harness([() => json(INVITE), failure]);
    await relay.runFetch(false);
    await relay.runFetch(false);
    assert.deepEqual(lines, ['members-source fetch outcome=stored status=200', `members-source fetch outcome=kept ${logged} retry=yes`]);
    assert.deepEqual(bodyOf(await getSource(relay)), SERVED);
  });
}

test('the call goes to the one fixed address with no credential, no redirect follow and a timeout (K3)', async () => {
  const calls: Call[] = [];
  await fetchInvite({ inviteCode: 'a-B9', fetchImpl: async (url, init) => { calls.push({ url, init }); return json(INVITE); }, now: () => NOW });
  assert.equal(calls.length, 1);
  const [{ url, init }] = calls as [Call];
  assert.equal(url, 'https://discord.com/api/v10/invites/a-B9?with_counts=true');
  assert.equal(init.method, 'GET');
  assert.equal(init.redirect, 'manual');
  assert.ok(init.signal instanceof AbortSignal);
  assert.deepEqual(init.headers, { 'User-Agent': USER_AGENT, Accept: 'application/json' });
});

test('the timer fetches at start and every 6 hours; a failure is retried once after 10 minutes', async () => {
  const { relay, calls, timeouts, intervals, lines } = harness([() => new Response('', { status: 500 }), () => new Response('', { status: 502 })]);
  await relay.start();
  assert.equal(calls.length, 1);
  assert.deepEqual(intervals.map(({ ms }) => ms), [CYCLE_MS]);
  assert.deepEqual(timeouts.map(({ ms }) => ms), [RETRY_MS]);
  timeouts[0]!.callback();
  await settle();
  assert.equal(calls.length, 2);
  assert.equal(timeouts.length, 1, 'a failed retry waits for the next cycle');
  assert.deepEqual(lines, [
    'members-source fetch outcome=kept status=500 reason=http_status retry=yes',
    'members-source fetch outcome=kept status=502 reason=http_status retry=no',
  ]);
});

test('a 429 is not retried: the next cycle is awaited (X4)', async () => {
  const { relay, calls, timeouts, lines } = harness([() => new Response('', { status: 429, headers: { 'retry-after': '1' } })]);
  await relay.start();
  assert.equal(calls.length, 1);
  assert.equal(timeouts.length, 0);
  assert.deepEqual(lines, ['members-source fetch outcome=kept status=429 reason=rate_limited retry=no']);
});

test('a success schedules no retry, and the next cycle refreshes the value', async () => {
  const clock = { now: NOW };
  const { relay, calls, timeouts, intervals } = harness([() => json(INVITE), () => json({ ...INVITE, approximate_member_count: 900 })], clock);
  await relay.start();
  assert.equal(timeouts.length, 0);
  clock.now = NOW + CYCLE_MS;
  intervals[0]!.callback();
  await settle();
  assert.equal(calls.length, 2);
  assert.deepEqual(bodyOf(await getSource(relay)), { ...SERVED, approximate_member_count: 900, fetchedAt: new Date(NOW + CYCLE_MS).toISOString() });
});

test('a failing log write does not end the process or reject the timer callback', async () => {
  const relay = createRelay({
    inviteCode: CODE, fetchImpl: async () => json(INVITE), now: () => NOW,
    log: () => { throw new Error('EPIPE'); },
    timers: { setTimeout: () => undefined, setInterval: () => undefined },
  });
  await relay.start();
  assert.equal(statusOf(await getSource(relay)), 200);
});

test('no request causes a Discord call', async () => {
  const { relay, calls } = harness([() => json(INVITE)]);
  await relay.runFetch(false);
  const requests = [
    `GET ${SOURCE_PATH} HTTP/1.1`, `HEAD ${SOURCE_PATH} HTTP/1.1`, `GET ${SOURCE_PATH}?refresh=1 HTTP/1.1`,
    `POST ${SOURCE_PATH} HTTP/1.1`, `GET ${HEALTH_PATH} HTTP/1.1`, 'GET / HTTP/1.1',
  ];
  for (const line of requests) await raw(relay, `${line}\r\nHost: x\r\nConnection: close\r\n\r\n`);
  assert.equal(calls.length, 1);
});

// The serving table of 2.11, with the fixed headers on every status and an empty body except the 200.
const stored = { body: Buffer.from(JSON.stringify(SERVED)), fetchedAtMs: NOW };
const table: Array<[string, string, string, typeof stored | null, number, number]> = [
  ['a fresh value', 'GET', SOURCE_PATH, stored, NOW + 1000, 200],
  ['a value exactly 24 h old', 'GET', SOURCE_PATH, stored, NOW + MAX_AGE_MS, 200],
  ['HEAD with a fresh value', 'HEAD', SOURCE_PATH, stored, NOW, 200],
  ['no value yet', 'GET', SOURCE_PATH, null, NOW, 503],
  ['HEAD with no value', 'HEAD', SOURCE_PATH, null, NOW, 503],
  ['a value older than 24 h', 'GET', SOURCE_PATH, stored, NOW + MAX_AGE_MS + 1, 503],
  ['an empty query string', 'GET', `${SOURCE_PATH}?`, stored, NOW, 404],
  ['a query string', 'GET', `${SOURCE_PATH}?x=1`, stored, NOW, 404],
  ['a trailing slash', 'GET', `${SOURCE_PATH}/`, stored, NOW, 404],
  ['an encoded dot', 'GET', '/data/members-source%2Ejson', stored, NOW, 404],
  ['an encoded slash', 'GET', '%2Fdata%2Fmembers-source.json', stored, NOW, 404],
  ['a double slash', 'GET', `/${SOURCE_PATH}`, stored, NOW, 404],
  ['the absolute form', 'GET', `http://empirecommunity.org${SOURCE_PATH}`, stored, NOW, 404],
  ['another file', 'GET', '/data/members.json', stored, NOW, 404],
  ['the root', 'GET', '/', stored, NOW, 404],
  ['POST', 'POST', SOURCE_PATH, stored, NOW, 405],
  ['DELETE', 'DELETE', SOURCE_PATH, null, NOW, 405],
  ['OPTIONS', 'OPTIONS', SOURCE_PATH, stored, NOW, 405],
  ['health without a value', 'GET', HEALTH_PATH, null, NOW, 200],
  ['POST on health', 'POST', HEALTH_PATH, null, NOW, 404],
];
for (const [name, method, target, value, now, status] of table) {
  test(`serving: ${name} answers ${status} with the fixed headers`, () => {
    const out = answer(method, target, value, now);
    assert.equal(out.status, status);
    for (const [header, expected] of Object.entries(FIXED_HEADERS)) assert.equal(out.headers[header], expected, header);
    assert.equal(out.headers['Allow'], status === 405 ? 'GET, HEAD' : undefined);
    assert.ok(!Object.keys(out.headers).some((header) => /^(set-cookie|access-control-)/i.test(header)));
    if (status === 200 && target === SOURCE_PATH) {
      assert.equal(out.headers['Content-Length'], String(stored.body.length));
      assert.equal(out.body, method === 'GET' ? stored.body : null, 'every GET gets the one prebuilt buffer');
    } else {
      assert.equal(out.body, null);
      assert.equal(out.headers['Content-Length'], '0');
    }
  });
}

test('the handler never touches the request body', () => {
  const { relay } = harness([]);
  // A request with only a method and a target: reading or listening to the body would throw here.
  const request = Object.freeze({ method: 'POST', url: SOURCE_PATH });
  const written: unknown[] = [];
  const response = { writeHead: (status: number) => written.push(status), end: () => written.push('end') };
  relay.handle(request, response as never);
  assert.deepEqual(written, [405, 'end']);
});

const rawCases: Array<[string, string, number]> = [
  ['a header block over the cap', `GET ${SOURCE_PATH} HTTP/1.1\r\nHost: x\r\nX-Big: ${'a'.repeat(9 * 1024)}\r\n\r\n`, 431],
  ['a malformed request line', 'NOT A REQUEST\r\n\r\n', 400],
  ['a request without Host', `GET ${HEALTH_PATH} HTTP/1.1\r\nConnection: close\r\n\r\n`, 200],
  ['Expect: 100-continue, answered at once', `POST ${SOURCE_PATH} HTTP/1.1\r\nHost: x\r\nExpect: 100-continue\r\nContent-Length: 5\r\nConnection: close\r\n\r\n`, 405],
  ['another Expect value', `GET ${SOURCE_PATH} HTTP/1.1\r\nHost: x\r\nExpect: something\r\nConnection: close\r\n\r\n`, 503],
  ['an upgrade request', `GET ${SOURCE_PATH} HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`, 503],
];
for (const [name, request, status] of rawCases) {
  test(`server: ${name} answers ${status} with the fixed headers`, async () => {
    const answerText = await raw(harness([]).relay, request);
    assert.ok(!answerText.startsWith('HTTP/1.1 100'), 'no 100 Continue');
    assert.equal(statusOf(answerText), status);
    const head = answerText.split('\r\n\r\n', 1)[0]!.toLowerCase();
    for (const [name, value] of Object.entries(FIXED_HEADERS)) assert.ok(head.includes(`\r\n${name.toLowerCase()}: ${value.toLowerCase()}`), name);
  });
}

test('the one setting is required and checked; proxy and TLS overrides refuse the start', () => {
  assert.deepEqual(readConfig({ DISCORD_INVITE_CODE: CODE }), { inviteCode: CODE });
  for (const env of [{}, { DISCORD_INVITE_CODE: '' }, { DISCORD_INVITE_CODE: 'a' }, { DISCORD_INVITE_CODE: 'x'.repeat(33) }, { DISCORD_INVITE_CODE: '../x' }, { DISCORD_INVITE_CODE: 'ab?c' }]) {
    assert.throws(() => readConfig(env), /^Error: invalid_invite_code$/);
  }
  for (const name of ['HTTPS_PROXY', 'https_proxy', 'NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_USE_ENV_PROXY', 'NODE_OPTIONS']) {
    assert.throws(() => readConfig({ DISCORD_INVITE_CODE: CODE, [name]: '0' }), new RegExp(`forbidden_env ${name}$`));
  }
});
