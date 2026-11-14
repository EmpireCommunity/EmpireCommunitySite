import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { SITE_ROUTER_RULE, relayComposeProblems, type RelayCompose } from '../scripts/lib/relay-compose-rules.ts';

const CODE = '7Pxg3gyr8n';
const template = () => parse(readFileSync('deploy/members-source/compose.yml', 'utf8')) as RelayCompose & { services: { relay: Record<string, unknown> } };
function changed(edit: (service: Record<string, unknown>, compose: ReturnType<typeof template>) => void) {
  const compose = template();
  edit(compose.services.relay, compose);
  return relayComposeProblems(compose, CODE);
}
const labelsOf = (service: Record<string, unknown>) => service.labels as string[];

test('the committed relay template follows the contract', () => {
  assert.deepEqual(relayComposeProblems(template(), CODE), []);
});

test('a relay invite code that differs from site.yaml fails (members-json 2.6)', () => {
  assert.ok(relayComposeProblems(template(), 'otherCode').some((problem) => problem.includes('site.yaml')));
});

// Each row is a rejected template from the negative tests of deploy 13.
const rejected: Array<[string, (service: Record<string, unknown>, compose: ReturnType<typeof template>) => void]> = [
  ['published port', (service) => { service.ports = ['8080:8080']; }],
  ['bind mount', (service) => { service.volumes = ['/data:/data']; }],
  ['docker socket', (service) => { service.volumes = ['/var/run/docker.sock:/var/run/docker.sock']; }],
  ['tmpfs', (service) => { service.tmpfs = ['/tmp']; }],
  ['second environment key', (service) => { service.environment = { DISCORD_INVITE_CODE: CODE, TOKEN: 'x' }; }],
  ['env_file', (service) => { service.env_file = ['.env']; }],
  ['secrets', (service) => { service.secrets = ['token']; }],
  ['another router rule', (service) => { service.labels = labelsOf(service).map((label) => label.replace(' && Path(`/data/members-source.json`)', '')); }],
  ['a wider path', (service) => { service.labels = labelsOf(service).map((label) => label.replace('/data/members-source.json', '/data/')); }],
  ['a middleware label', (service) => { service.labels = [...labelsOf(service), 'traefik.http.routers.empirecommunity-members-relay.middlewares=x']; }],
  ['a second router', (service) => { service.labels = [...labelsOf(service), 'traefik.http.routers.other.rule=Host(`empirecommunity.org`)']; }],
  ['no priority', (service) => { service.labels = labelsOf(service).filter((label) => !label.includes('.priority=')); }],
  ['a priority not above the site rule', (service) => { service.labels = labelsOf(service).map((label) => label.replace('priority=100', `priority=${SITE_ROUTER_RULE.length}`)); }],
  ['the site router name', (service) => { service.labels = labelsOf(service).map((label) => label.replaceAll('empirecommunity-members-relay', 'empirecommunity-site')); }],
  ['a service port other than 8080', (service) => { service.labels = labelsOf(service).map((label) => label.replace('server.port=8080', 'server.port=80')); }],
  ['running as root', (service) => { service.user = '0:0'; }],
  ['no user', (service) => { delete service.user; }],
  ['writable root filesystem', (service) => { service.read_only = false; }],
  ['a capability added', (service) => { service.cap_add = ['NET_ADMIN']; }],
  ['privileged', (service) => { service.privileged = true; }],
  ['another network', (service) => { service.networks = ['proxy', 'default']; }],
  ['a disabled healthcheck', (service) => { service.healthcheck = { disable: true }; }],
  ['the site image', (service) => { service.image = String(service.image).replace('-members-relay', ''); }],
  ['a mutable tag', (service) => { service.image = 'docker.io/empirecommunity/empirecommunity-site-org:latest'; }],
  ['a second service', (_service, compose) => { compose.services.other = {}; }],
];
for (const [name, edit] of rejected) {
  test(`the relay template is rejected with ${name}`, () => {
    assert.ok(changed(edit).length > 0);
  });
}
