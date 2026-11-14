// Runs INSIDE the relay container (piped to its Node on stdin by scripts/check-relay-run.sh), because the container has
// no network and publishes no port. Prints one line per violation of members-json 2.11 and exits 1 if there is any.
import http from 'node:http';
import process from 'node:process';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'cross-origin-resource-policy': 'same-origin',
};
const PATH = '/data/members-source.json';
// method, path, expected status, expected Allow header (405 only)
const CASES = [
  ['GET', '/healthz', 200], ['GET', PATH, 503], ['HEAD', PATH, 503],
  ['GET', `${PATH}?`, 404], ['GET', `${PATH}?x=1`, 404], ['GET', `${PATH}/`, 404], ['GET', '/data/members-source%2Ejson', 404],
  ['GET', '/data/members.json', 404], ['GET', '/', 404],
  ['POST', PATH, 405, 'GET, HEAD'], ['DELETE', PATH, 405, 'GET, HEAD'],
];

const ask = (method, path) => new Promise((resolve) => {
  const request = http.request({ host: '127.0.0.1', port: 8080, method, path, timeout: 5000 }, (response) => {
    let bytes = 0;
    response.on('data', (chunk) => { bytes += chunk.length; });
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes }));
  });
  request.on('error', () => resolve({ status: 0, headers: {}, bytes: 0 }));
  request.on('timeout', () => request.destroy());
  request.end();
});

let problems = 0;
const fail = (message) => { problems += 1; process.stdout.write(`${message}\n`); };
for (const [method, path, status, allow] of CASES) {
  const answer = await ask(method, path);
  if (answer.status !== status) { fail(`${method} ${path} must answer ${status}, got ${answer.status}`); continue; }
  for (const [name, value] of Object.entries(HEADERS)) if (answer.headers[name] !== value) fail(`${method} ${path}: header ${name} is missing or wrong`);
  if (allow !== undefined && answer.headers.allow !== allow) fail(`${method} ${path}: Allow must be "${allow}"`);
  if (status !== 200 && method !== 'HEAD' && answer.bytes !== 0) fail(`${method} ${path}: the body of a ${status} must be empty`);
}
process.exit(problems > 0 ? 1 : 0);
