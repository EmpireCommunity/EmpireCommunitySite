// Pure rules for the member-count relay compose template (docs/contracts/deploy.md section 13). The script reads the
// files; this module only decides, so each rule has a test. Every rule is a requirement of the contract, none is optional.
import { foldLabels } from './compose-resolve.ts';

export const RELAY_IMAGE = /^docker\.io\/empirecommunity\/empirecommunity-site-org:\d+\.\d+\.\d+(?:-rc\.\d+)?-members-relay@sha256:[0-9a-f]{64}$/;
export const RELAY_ROUTER_RULE = 'Host(`empirecommunity.org`) && Path(`/data/members-source.json`)';
// Traefik gives the site's host-only rule a priority equal to its length; the relay router must be explicitly above it.
export const SITE_ROUTER_RULE = 'Host(`empirecommunity.org`)';
// Keys a service may carry, in the form written in the template and in the form `docker compose config` resolves.
const SERVICE_KEYS = new Set(['image', 'user', 'read_only', 'cap_drop', 'security_opt', 'mem_limit', 'pids_limit', 'restart', 'healthcheck',
  'environment', 'networks', 'logging', 'labels', 'command', 'entrypoint']);
export const HEALTHCHECK = ['CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:8080/healthz'];
const INVITE_CODE = /^[A-Za-z0-9-]{2,32}$/;

type Service = Record<string, unknown> & { labels?: string[] | Record<string, string> };
export interface RelayCompose {
  name?: unknown;
  services?: Record<string, Service>;
  networks?: Record<string, { name?: string; external?: boolean }>;
}

/** Problems of the relay template against the contract, or an empty list. `siteInviteCode` is `discord.inviteCode` of site.yaml. */
export function relayComposeProblems(compose: RelayCompose, siteInviteCode: string): string[] {
  const problems: string[] = [];
  const fail = (message: string) => problems.push(message);
  if (compose.name !== 'empirecommunity-members') fail('the compose project must be named empirecommunity-members');
  const names = Object.keys(compose.services ?? {});
  const service = names.length === 1 ? compose.services?.[names[0] ?? ''] : undefined;
  if (service === undefined) { fail('the template must define exactly one service'); return problems; }

  if (typeof service.image !== 'string' || !RELAY_IMAGE.test(service.image)) fail('image must be docker.io/empirecommunity/empirecommunity-site-org:<X.Y.Z>-members-relay@sha256:<64 hex>');

  const { labels, duplicates } = foldLabels(service.labels);
  for (const key of duplicates) fail(`label ${key} appears twice (keys are compared in lower case)`);
  for (const key of Object.keys(labels)) if (!key.startsWith('traefik.')) fail(`unexpected label ${key}`);
  const traefik = Object.entries(labels).filter(([key]) => key.startsWith('traefik.'));
  const rules = traefik.filter(([key]) => /^traefik\.http\.routers\.[^.]+\.rule$/.test(key));
  const router = /^traefik\.http\.routers\.([^.]+)\.rule$/.exec(rules[0]?.[0] ?? '')?.[1];
  const ports = traefik.filter(([key]) => /^traefik\.http\.services\.[^.]+\.loadbalancer\.server\.port$/.test(key));
  const expected = new Set(['traefik.enable', 'traefik.docker.network', ...rules.map(([key]) => key), ...ports.map(([key]) => key),
    ...(router === undefined ? [] : [`traefik.http.routers.${router}.priority`])]);
  for (const [key] of traefik) if (!expected.has(key)) fail(`unexpected label ${key}`);
  if (labels['traefik.enable'] !== 'true') fail('traefik.enable must be true');
  if (labels['traefik.docker.network'] !== 'proxy') fail('traefik.docker.network must be proxy');
  if (rules.length !== 1 || rules[0]?.[1] !== RELAY_ROUTER_RULE) fail(`exactly one router rule, and it must be ${RELAY_ROUTER_RULE}`);
  if (router === 'empirecommunity-site') fail('the relay router must be named differently from the site router');
  const priority = router === undefined ? undefined : labels[`traefik.http.routers.${router}.priority`];
  if (priority === undefined || !/^[1-9]\d{0,5}$/.test(priority) || Number(priority) <= SITE_ROUTER_RULE.length) {
    fail(`the router needs an explicit priority above ${SITE_ROUTER_RULE.length} (the priority Traefik gives the site's host-only rule)`);
  }
  if (ports.length !== 1 || String(ports[0]?.[1]) !== '8080') fail('exactly one service port, and it must be 8080');

  const user = typeof service.user === 'string' || typeof service.user === 'number' ? String(service.user) : '';
  if (user !== '1000:1000') fail('user must be exactly 1000:1000');
  if (service.read_only !== true) fail('read_only must be true');
  if (JSON.stringify(service.cap_drop) !== '["ALL"]') fail('cap_drop must be [ALL]');
  if (Array.isArray(service.cap_add) ? service.cap_add.length > 0 : service.cap_add !== undefined) fail('cap_add must be empty or absent');
  if (JSON.stringify(service.security_opt) !== '["no-new-privileges:true"]') fail('security_opt must be exactly [no-new-privileges:true]');
  if (!['64m', '67108864'].includes(String(service.mem_limit))) fail('mem_limit must be 64m');
  if (service.pids_limit !== 64) fail('pids_limit must be 64');
  if (service.restart !== 'unless-stopped') fail('restart must be unless-stopped');

  const health = service.healthcheck as { test?: unknown; disable?: unknown } | undefined;
  if (health === undefined) fail('healthcheck is required');
  else if (health.disable === true) fail('the healthcheck must not be disabled');
  else if (JSON.stringify(health.test) !== JSON.stringify(HEALTHCHECK)) fail(`the healthcheck command must be exactly ${JSON.stringify(HEALTHCHECK)}`);

  // Allowlist of service keys: anything else (ports, volumes, privileged, network_mode, a YAML merge key `<<`, ...) is refused,
  // so a key the contract never named cannot widen the container. `command` and `entrypoint` may only be null (the image decides).
  for (const key of Object.keys(service)) {
    if (!SERVICE_KEYS.has(key)) fail(`${key} is not allowed in the relay template`);
  }
  if (service.command != null || service.entrypoint != null) fail('command and entrypoint are not allowed in the relay template');
  const environment = service.environment;
  const environmentKeys = Array.isArray(environment) ? environment.map((item) => String(item).split('=')[0]) : Object.keys((environment ?? {}) as object);
  if (environmentKeys.length !== 1 || environmentKeys[0] !== 'DISCORD_INVITE_CODE') fail('environment must hold exactly one key, DISCORD_INVITE_CODE');
  const entries = Array.isArray(environment) ? Object.fromEntries(environment.map((item) => String(item).split(/=(.*)/s).slice(0, 2))) : (environment ?? {}) as Record<string, unknown>;
  const code = String(entries.DISCORD_INVITE_CODE ?? '');
  if (!INVITE_CODE.test(code)) fail('DISCORD_INVITE_CODE must be a public invite code');
  else if (code !== siteInviteCode) fail('DISCORD_INVITE_CODE must equal discord.inviteCode in src/data/site.yaml (members-json 2.6)');

  const serviceNetworks = Array.isArray(service.networks) ? service.networks : Object.keys((service.networks ?? {}) as object);
  const perNetwork = Array.isArray(service.networks) ? [] : Object.values((service.networks ?? {}) as Record<string, unknown>);
  if (perNetwork.some((entry) => entry !== null)) fail('the proxy network entry has no options (aliases, ipv4_address, ...)');
  if (JSON.stringify(serviceNetworks) !== '["proxy"]') fail('the service joins only the proxy network');
  const logging = service.logging as { driver?: string; options?: Record<string, string> } | undefined;
  if (logging?.driver !== 'json-file' || logging.options?.['max-size'] !== '1m' || String(logging.options['max-file']) !== '2') {
    fail('logging must be json-file with max-size 1m and max-file 2 (D-20)');
  }
  if (Object.keys(compose.networks ?? {}).join() !== 'proxy' || compose.networks?.proxy?.external !== true || (compose.networks.proxy.name ?? 'proxy') !== 'proxy') fail('the only top-level network is the external proxy network, and there is no top-level volume or secret');
  const extra = Object.keys(compose).filter((key) => !['name', 'services', 'networks'].includes(key));
  if (extra.length > 0) fail(`unexpected top-level key: ${extra.join(', ')}`);
  return problems;
}
