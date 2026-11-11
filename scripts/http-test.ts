// HTTP header test (docs/contracts/routing-locale.md section 6). Runs against the built image in CI and against the
// public URL after a deploy.
// Usage: BASE_URL=http://127.0.0.1:18080 node scripts/http-test.ts      (add PUBLIC=1 for the proxy-layer headers)
import { PENDING } from './lib/pending.ts';

const base = (process.env.BASE_URL ?? '').replace(/\/$/, '');
const publicUrl = process.env.PUBLIC === '1';
if (base === '') {
  console.error('BASE_URL is required');
  process.exit(2);
}

const DEFAULT_CSP = "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const SUPPORT_CSP = "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const NO_CACHE = 'no-cache';
// Values of the routing contract section 6 (snippets/security-headers.conf).
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()';
const COOP = 'same-origin';

const problems: string[] = [];
const fail = (where: string, message: string) => problems.push(`${where}: ${message}`);

type Expectation = { path: string; status: number[]; csp: string; cache: string | string[] };

async function checkPath(expected: Expectation, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${base}${expected.path}`, { redirect: 'manual', ...init });
  const where = `${init.method ?? 'GET'} ${expected.path}`;
  if (!expected.status.includes(response.status)) fail(where, `status ${response.status}, expected ${expected.status.join(' or ')}`);
  if (response.headers.get('content-security-policy') !== expected.csp) fail(where, 'Content-Security-Policy differs from the contract');
  if (response.headers.get('permissions-policy') !== PERMISSIONS_POLICY) fail(where, 'Permissions-Policy differs from the contract');
  if (response.headers.get('cross-origin-opener-policy') !== COOP) fail(where, 'Cross-Origin-Opener-Policy differs from the contract');
  const cache = response.headers.get('cache-control');
  const acceptable = Array.isArray(expected.cache) ? expected.cache : [expected.cache];
  if (cache === null || !acceptable.includes(cache)) fail(where, `Cache-Control is ${cache}, expected ${acceptable.join(' or ')}`);
  const server = response.headers.get('server');
  if (server !== null && /\d/.test(server)) fail(where, `Server header exposes a version: ${server}`);
  if (response.headers.get('set-cookie') !== null) fail(where, 'Set-Cookie present');
  if (publicUrl) {
    for (const header of ['x-content-type-options', 'referrer-policy', 'strict-transport-security']) {
      if (response.headers.get(header) === null) fail(where, `${header} missing at the public URL`);
    }
  }
  return response;
}

const home = await checkPath({ path: '/pt-br/', status: [200], csp: DEFAULT_CSP, cache: NO_CACHE });
await checkPath({ path: '/en-us/support/', status: [200], csp: SUPPORT_CSP, cache: NO_CACHE });
// Slashless: redirected, and the redirect already carries the support-page CSP.
await (await checkPath({ path: '/en-us/support', status: [301], csp: SUPPORT_CSP, cache: NO_CACHE })).arrayBuffer();
await checkPath({ path: '/no-such-page/', status: [404], csp: DEFAULT_CSP, cache: NO_CACHE });
await checkPath({ path: '/healthz', status: [200], csp: DEFAULT_CSP, cache: 'no-store' });
// members.json is served by the Worker in production; the origin fallback may not exist yet. Either way the headers
// are there: a 200 carries the location's cache value, and a 404 is served from the 404 page (no-cache).
const membersProbe = await fetch(`${base}/data/members.json`, { redirect: 'manual' });
await membersProbe.arrayBuffer();
// Once the build generates the fallback (PENDING.membersFallback false) a 404 is a failure, not an allowed outcome.
const membersOk = membersProbe.status === 200;
await checkPath({
  path: '/data/members.json',
  status: PENDING.membersFallback ? [membersOk ? 200 : 404] : [200],
  csp: DEFAULT_CSP,
  // Origin file: max-age=300. At the public URL the Worker may answer with its documented max-age=600 (members-json 1).
  cache: membersOk ? (publicUrl ? ['public, max-age=300', 'public, max-age=600'] : 'public, max-age=300') : NO_CACHE,
});

// A query string never reaches the file (members-json 2.9).
const members = await checkPath({ path: '/data/members.json?x=1', status: [404], csp: DEFAULT_CSP, cache: NO_CACHE });
await members.arrayBuffer();

// The method rule wins over the query rule: POST with a query string is 405, never 404 (routing-locale section 6).
await (await checkPath({ path: '/data/members.json?x=1', status: [405], csp: DEFAULT_CSP, cache: 'public, max-age=300' }, { method: 'POST', body: 'x' })).arrayBuffer();

const asset = /href="(\/_astro\/[^"]+)"/.exec(await home.text())?.[1];
if (asset === undefined) fail('GET /pt-br/', 'no /_astro/ asset referenced to test');
else await checkPath({ path: asset, status: [200], csp: DEFAULT_CSP, cache: 'public, max-age=31536000, immutable' });

const post = await checkPath({ path: '/pt-br/', status: [405], csp: DEFAULT_CSP, cache: NO_CACHE }, { method: 'POST', body: 'x' });
await post.arrayBuffer();

// The method rule covers every location, healthz included (routing-locale section 6).
const healthPost = await checkPath({ path: '/healthz', status: [405], csp: DEFAULT_CSP, cache: 'no-store' }, { method: 'POST', body: 'x' });
await healthPost.arrayBuffer();

// A locale URL without the trailing slash is redirected (relative Location), the slash form answers 200.
const slashless = await checkPath({ path: '/pt-br/projects', status: [301], csp: DEFAULT_CSP, cache: NO_CACHE });
await slashless.arrayBuffer();
if (slashless.status === 301 && slashless.headers.get('location') !== '/pt-br/projects/') {
  fail('GET /pt-br/projects', `Location is ${slashless.headers.get('location')}, expected /pt-br/projects/`);
}
const slashed = await fetch(`${base}/pt-br/projects/`, { redirect: 'manual' });
await slashed.arrayBuffer();
if (slashed.status !== 200) fail('GET /pt-br/projects/', `status ${slashed.status}, expected 200`);

// /discord answers 200 with no Location header, with or without a query string (D-29), under the default headers
// (CSP, Permissions-Policy, COOP, no-cache, no Set-Cookie: checkPath) and with the same link targets whatever the query.
const discordProbe = await fetch(`${base}/discord`, { redirect: 'manual' });
await discordProbe.arrayBuffer();
if (discordProbe.status === 404 && PENDING.discordPage) {
  console.log('::warning::GET /discord is 404 (pending in the scaffold, see scripts/lib/pending.ts)');
} else {
  const hrefs = (html: string) => [...html.matchAll(/\bhref="([^"]*)"/g)].map((match) => match[1] ?? '').sort();
  const bodies: string[] = [];
  for (const path of ['/discord', '/discord?utm_source=ci', '/discord/?utm_source=ci']) {
    const response = await checkPath({ path, status: [200], csp: DEFAULT_CSP, cache: NO_CACHE });
    if (response.headers.get('location') !== null) fail(`GET ${path}`, 'Location header present');
    bodies.push(await response.text());
  }
  const [plain, ...withQuery] = bodies.map(hrefs);
  withQuery.forEach((links, index) => {
    if (JSON.stringify(links) !== JSON.stringify(plain)) fail(`GET /discord (query form ${index + 1})`, 'link targets differ from the page without a query string');
  });
}

if (problems.length > 0) {
  for (const problem of problems) console.log(`::error::${problem}`);
  console.log(`http-test: ${problems.length} problem(s).`);
  process.exit(1);
}
console.log('http-test: all header checks passed.');
