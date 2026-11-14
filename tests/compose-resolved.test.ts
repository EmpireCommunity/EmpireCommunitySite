import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

// The compose checks judge what Docker Compose resolves, so each case writes a template and runs the real script on it.
const hasCompose = spawnSync('docker', ['compose', 'version']).status === 0;
// In CI a missing Docker Compose fails the file instead of skipping every case.
test('docker compose is available in CI', { skip: process.env.CI === undefined }, () => assert.ok(hasCompose));
const relay = readFileSync('deploy/members-source/compose.yml', 'utf8');
const site = readFileSync('deploy/compose.yml', 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'compose-resolved-'));

function run(script: string, text: string, extra: Record<string, string> = {}): number | null {
  const file = join(dir, 'compose.yml');
  writeFileSync(file, text);
  for (const [name, body] of Object.entries(extra)) writeFileSync(join(dir, name), body);
  return spawnSync('node', [script, file]).status;
}
const after = (text: string, anchor: string, lines: string) => text.replace(anchor, `${anchor}\n${lines}`);

const SOCKET = '    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock';
const cases: Array<[string, (text: string) => string, Record<string, string>?]> = [
  ['a merge key with a docker.sock bind', (t) => after(t, '    read_only: true', `    <<: { volumes: [/var/run/docker.sock:/var/run/docker.sock] }`)],
  ['a merge key from an anchor', (t) => `x-bad: &bad\n  privileged: true\n${after(t, '    read_only: true', '    <<: *bad')}`],
  ['a capitalised router rule label', (t) => t.replace(/- traefik\.http\.routers\.[^\n]*\.rule=[^\n]*/, (m) => `${m}\n      - Traefik.HTTP.Routers.Other.Rule=Host(\`empirecommunity.org\`)`)],
  ['a capitalised middleware label', (t) => after(t, '    labels:', '      - Traefik.http.routers.x.Middlewares=y')],
  ['a duplicate label after folding', (t) => after(t, '    labels:', '      - TRAEFIK.ENABLE=false')],
  ['label_file', (t) => after(t, '    labels:', '').replace('    labels:', '    label_file: [extra.labels]\n    labels:'), { 'extra.labels': 'traefik.http.routers.evil.rule=Host(`empirecommunity.org`)\n' }],
  ['use_api_socket', (t) => after(t, '    read_only: true', '    use_api_socket: true')],
  ['volumes_from', (t) => after(t, '    read_only: true', '    volumes_from: [other]')],
  ['extends', (t) => after(t, '    read_only: true', '    extends:\n      file: base.yml\n      service: base'), { 'base.yml': `services:\n  base:\n    image: alpine\n${SOCKET}\n` }],
  ['an extra security_opt', (t) => t.replace('- no-new-privileges:true', '- no-new-privileges:true\n      - seccomp=unconfined')],
  ['userns_mode', (t) => after(t, '    read_only: true', '    userns_mode: host')],
  ['cgroup host', (t) => after(t, '    read_only: true', '    cgroup: host')],
  ['group_add', (t) => after(t, '    read_only: true', '    group_add: ["0"]')],
  ['post_start', (t) => after(t, '    read_only: true', '    post_start:\n      - command: touch /x')],
  ['a privileged service hidden behind a profile', (t) => `${t.replace(/\nnetworks:/, `\n  hidden:\n    image: alpine\n    profiles: [x]\n    privileged: true\n${SOCKET}\n\nnetworks:`)}`],
  ['an image written as a variable with a valid default', (t) => t.replace(/image: .*/, (m) => `image: \${IMG:-${m.slice(7)}}`)],
  ['a network alias', (t) => t.replace(/networks:\n      - proxy/, 'networks:\n      proxy:\n        aliases: [x]')],
  ['a top-level network renamed', (t) => t.replace('  proxy:\n    external: true', '  proxy:\n    external: true\n    name: other')],
  ['a CMD-SHELL healthcheck chaining a command', (t) => t.replace(/test: \[[^\n]*\]/, 'test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:8080/healthz && touch /x"]')],
];

for (const [script, template] of [['scripts/check-relay-compose.ts', relay], ['scripts/check-compose.ts', site]] as const) {
  test(`${script} accepts the committed template`, { skip: !hasCompose }, () => {
    assert.equal(run(script, template), 0);
  });
  for (const [name, edit, extra] of cases) {
    test(`${script} rejects ${name}`, { skip: !hasCompose }, () => {
      assert.notEqual(run(script, edit(template), extra), 0);
    });
  }
}
