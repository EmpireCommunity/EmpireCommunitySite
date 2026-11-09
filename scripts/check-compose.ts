// Compose template validation (docs/contracts/deploy.md sections 4 and 7).
// Usage: node scripts/check-compose.ts [deploy/compose.yml]
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const file = process.argv[2] ?? 'deploy/compose.yml';
const IMAGE = /^ghcr\.io\/empirecommunity\/empirecommunitysite:\d+\.\d+\.\d+(?:-rc\.\d+)?@sha256:[0-9a-f]{64}$/;
const ROUTER_RULE = 'Host(`empirecommunity.org`)';

type Service = Record<string, unknown> & { labels?: string[] | Record<string, string> };
const compose = parse(readFileSync(file, 'utf8')) as { services?: Record<string, Service>; networks?: Record<string, { external?: boolean }> };

const problems: string[] = [];
const fail = (message: string) => problems.push(message);

const names = Object.keys(compose.services ?? {});
const service = names.length === 1 ? compose.services?.[names[0] ?? ''] : undefined;
if (service === undefined) {
  fail('the template must define exactly one service');
} else {
  if (typeof service.image !== 'string' || !IMAGE.test(service.image)) fail('image must be ghcr.io/empirecommunity/empirecommunitysite:<X.Y.Z>@sha256:<64 hex>');

  // Only these traefik.* keys, with these values (a stray label could route another host name).
  const raw = service.labels ?? [];
  const labels = Array.isArray(raw)
    ? Object.fromEntries(raw.map((item) => [item.slice(0, item.indexOf('=')), item.slice(item.indexOf('=') + 1)]))
    : raw;
  const traefik = Object.entries(labels).filter(([key]) => key.startsWith('traefik.'));
  const rules = traefik.filter(([key]) => /^traefik\.http\.routers\.[^.]+\.rule$/.test(key));
  const ports = traefik.filter(([key]) => /^traefik\.http\.services\.[^.]+\.loadbalancer\.server\.port$/.test(key));
  const expected = new Set(['traefik.enable', 'traefik.docker.network', ...rules.map(([k]) => k), ...ports.map(([k]) => k)]);
  for (const [key] of traefik) if (!expected.has(key)) fail(`unexpected label ${key}`);
  if (labels['traefik.enable'] !== 'true') fail('traefik.enable must be true');
  if (labels['traefik.docker.network'] !== 'proxy') fail('traefik.docker.network must be proxy');
  if (rules.length !== 1 || rules[0]?.[1] !== ROUTER_RULE) fail(`exactly one router rule, and it must be ${ROUTER_RULE}`);
  if (ports.length !== 1 || String(ports[0]?.[1]) !== '8080') fail('exactly one service port, and it must be 8080');

  // Host requirements (section 7).
  if (service.read_only !== true) fail('read_only must be true');
  if (JSON.stringify(service.cap_drop) !== '["ALL"]') fail('cap_drop must be [ALL]');
  if (!Array.isArray(service.security_opt) || !service.security_opt.includes('no-new-privileges:true')) fail('security_opt must include no-new-privileges:true');
  if (service.mem_limit !== '32m') fail('mem_limit must be 32m');
  if (service.pids_limit !== 64) fail('pids_limit must be 64');
  if (service.restart !== 'unless-stopped') fail('restart must be unless-stopped');
  const tmpfs = [service.tmpfs].flat().filter((item): item is string => typeof item === 'string');
  if (!tmpfs.some((mount) => mount === '/tmp' || mount.startsWith('/tmp:'))) fail('tmpfs must mount /tmp (nginx writes its pid and temp files there on a read-only filesystem)');
  if (Array.isArray(service.cap_add) ? service.cap_add.length > 0 : service.cap_add !== undefined) fail('cap_add must be empty or absent');
  const health = service.healthcheck as { test?: unknown; disable?: unknown } | undefined;
  const command = Array.isArray(health?.test) ? health.test.map(String) : [String(health?.test ?? '')];
  if (health === undefined) fail('healthcheck is required');
  else if (health.disable === true || command[0]?.trim().startsWith('NONE') === true) fail('the healthcheck must not be disabled');
  else if (!/https?:\/\/[^\s"']+\/healthz(?![\w/-])/.test(command.join(' '))) fail('the healthcheck must probe /healthz');
  for (const forbidden of ['ports', 'volumes', 'environment', 'env_file', 'privileged', 'network_mode', 'devices']) {
    if (service[forbidden] !== undefined) fail(`${forbidden} is not allowed (no published ports, bind mounts, secrets or docker socket)`);
  }
  if (JSON.stringify(service.networks) !== '["proxy"]') fail('the service joins only the proxy network');
  const logging = service.logging as { driver?: string; options?: Record<string, string> } | undefined;
  if (logging?.driver !== 'json-file' || logging.options?.['max-size'] !== '1m' || String(logging.options['max-file']) !== '2') {
    fail('logging must be json-file with max-size 1m and max-file 2 (D-20)');
  }
}
if (compose.networks?.proxy?.external !== true) fail('the proxy network must be external');

if (problems.length > 0) {
  for (const problem of problems) console.log(`::error file=${file}::${problem}`);
  process.exit(1);
}
console.log(`check-compose: ${file} follows the deploy contract.`);
