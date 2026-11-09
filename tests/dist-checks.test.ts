import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  discordLinks, hreflangReciprocity, inlineExecutable, membersFallback, paymentGuard, whatsappAbsent,
} from '../scripts/lib/dist-checks.ts';
import { checkWorkflow } from '../scripts/lib/workflow-rules.ts';

const errors = (findings: { level?: string }[]) => findings.filter((f) => f.level === 'error').length;

test('payment guard refuses every marker of site-data section 10 and accepts the allowlisted e-mail', () => {
  const allowed = new Set(['contact@empirecommunity.org']);
  const bad = [
    '<div data-pix="x">', 'https://mpago.la/abc', '00020126BR.GOV.BCB.PIX', 'key 123e4567-e89b-42d3-a456-426614174000',
    '12.345.678/0001-95', 'write to someone@example.com',
  ];
  for (const text of bad) assert.equal(errors(paymentGuard(text, 'x.html', allowed)), 1, text);
  assert.equal(paymentGuard('contact@empirecommunity.org, p-3f9a1c7d2b40', 'x.html', allowed).length, 0);
});

test('inline script, style and handlers fail; external scripts and ld+json pass', () => {
  assert.equal(inlineExecutable('<script src="/a.js"></script><script type="application/ld+json">{}</script>', 'p').length, 0);
  for (const html of ['<script>alert(1)</script>', '<style>a{}</style>', '<p style="x">', '<a onclick="x()">']) {
    assert.equal(inlineExecutable(html, 'p').length, 1, html);
  }
});

test('WhatsApp is caught in any spelling', () => {
  for (const text of ['WhatsApp', 'whats app', 'https://wa.me/55', 'https://api.whatsapp.com/send']) {
    assert.equal(whatsappAbsent(text, 'f').length, 1, text);
  }
});

test('the Discord invite is allowed only on the /discord page, with the configured code and no script', () => {
  const invite = 'https://discord.com/invite/abc123';
  const page = `<meta http-equiv="refresh" content="0;url=${invite}"><a href="${invite}">go</a>`;
  assert.equal(discordLinks(page, 'discord/index.html', 'abc123', true).length, 0);
  assert.equal(discordLinks(page, 'pt-br/index.html', 'abc123', false).length, 2);
  assert.equal(discordLinks(page.replace('abc123', 'zzz'), 'discord/index.html', 'abc123', true).length > 0, true);
  assert.equal(discordLinks(`${page}<script></script>`, 'discord/index.html', 'abc123', true).length, 1);
  assert.equal(discordLinks('<a href="https://empirecommunity.org/discord">', 'pt-br/index.html', 'abc123', false).length, 0);
});

test('hreflang must be reciprocal and canonical must be the page itself', () => {
  const origin = 'https://e.org';
  const head = (self: string, other: string) =>
    `<link rel="canonical" href="${origin}${self}"><link rel="alternate" hreflang="pt-BR" href="${origin}/pt-br/">` +
    `<link rel="alternate" hreflang="en-US" href="${origin}/en-us/"><link rel="alternate" hreflang="x-default" href="${origin}${other}">`;
  const ok = new Map([['/pt-br/', head('/pt-br/', '/en-us/')], ['/en-us/', head('/en-us/', '/en-us/')]]);
  assert.equal(hreflangReciprocity(ok, origin).length, 0);
  const broken = new Map(ok).set('/en-us/', '<link rel="canonical" href="https://e.org/en-us/">');
  assert.ok(hreflangReciprocity(broken, origin).length > 0);
});

test('workflow hygiene: unpinned action, missing permissions and pull_request_target are rejected', () => {
  const good = { on: 'push', permissions: {}, jobs: { a: { 'timeout-minutes': 1, steps: [{ uses: 'x/y@' + 'a'.repeat(40) }] } } };
  assert.equal(checkWorkflow('w', good).length, 0);
  const bad = { on: { pull_request_target: {} }, jobs: { a: { steps: [{ uses: 'x/y@v1' }, { run: 'echo ${{ github.event.pull_request.title }}' }] } } };
  assert.equal(checkWorkflow('w', bad).length, 5);
});

test('workflow rule: only worker-deploy.yml may name the worker-production environment', () => {
  const wf = { on: 'push', permissions: {}, jobs: { a: { 'timeout-minutes': 1, environment: 'worker-production', steps: [] } } };
  assert.equal(checkWorkflow('.github/workflows/worker-deploy.yml', wf).length, 0);
  assert.equal(checkWorkflow('.github/workflows/ci.yml', wf).length, 1);
});

test('members fallback validates the members.json v1 shape and the built-in source', () => {
  const ok = { schema: 1, discord: { members: 888, updatedAt: '2026-11-09T00:00:03.120Z', source: 'built-in' } };
  assert.equal(membersFallback(JSON.stringify(ok), 'm').length, 0);
  for (const bad of [{ ...ok, schema: 2 }, { ...ok, discord: { ...ok.discord, members: 0 } }, { ...ok, discord: { ...ok.discord, source: 'x' } }]) {
    assert.equal(membersFallback(JSON.stringify(bad), 'm').length, 1);
  }
  assert.equal(membersFallback('{', 'm').length, 1);
});

test('regressions of the PR 4 review: dist-checks rules', () => {
  // inlineExecutable: data-* attributes are not src or type
  for (const html of ['<script data-src="/a.js">run()</script>', '<script data-type="application/ld+json">run()</script>']) {
    assert.equal(inlineExecutable(html, 'p').length, 1, html);
  }
  // discordLinks: a protocol-relative invite is a Discord URL
  assert.equal(discordLinks('<a href="//discord.gg/abc123">', 'pt-br/index.html', 'abc123', false).length, 1);
  // hreflang: swapped locale targets are refused even when each page links back
  const origin = 'https://e.org';
  const head = (pt: string, en: string) =>
    `<link rel="alternate" hreflang="pt-BR" href="${origin}${pt}"><link rel="alternate" hreflang="en-US" href="${origin}${en}">` +
    `<link rel="alternate" hreflang="x-default" href="${origin}/en-us/">`;
  const swapped = new Map([
    ['/pt-br/', `<link rel="canonical" href="${origin}/pt-br/">${head('/en-us/', '/pt-br/')}`],
    ['/en-us/', `<link rel="canonical" href="${origin}/en-us/">${head('/en-us/', '/pt-br/')}`],
  ]);
  assert.ok(hreflangReciprocity(swapped, origin).length > 0);
  // membersFallback: null root, bare date and a missing offset are findings, never a throw
  const body = (updatedAt: string) => JSON.stringify({ schema: 1, discord: { members: 5, updatedAt, source: 'built-in' } });
  for (const text of ['null', '[]', '{"schema":1,"discord":null}', body('2026-11-09'), body('2026-11-09T00:00:00'), body('2026-13-09T00:00:00Z')]) {
    assert.equal(membersFallback(text, 'm').length, 1, text);
  }
  assert.equal(membersFallback(body('2026-11-09T00:00:03.120+00:00'), 'm').length, 0);
});

test('regressions of the PR 4 review: workflow rules', () => {
  const pin = 'x/y@' + 'a'.repeat(40);
  const wf = (over: object, step: object = { uses: pin }) =>
    ({ on: 'push', permissions: {}, jobs: { a: { 'timeout-minutes': 1, steps: [step], ...over } } });
  const count = (file: string, workflow: object) => checkWorkflow(file, workflow as never).length;
  // event data reached through functions or brackets inside a shell step
  for (const run of ['echo ${{ fromJSON(toJSON(github.event.pull_request)).title }}', 'echo ${{ toJSON(github) }}', "echo ${{ github['event'].pull_request.title }}"]) {
    assert.equal(count('w', wf({}, { run })), 1, run);
  }
  assert.equal(count('w', wf({}, { run: 'echo ${{ github.event_name }} ${{ github.sha }}' })), 0);
  // on as an array
  assert.equal(count('w', { ...wf({}), on: ['push', 'pull_request_target'] }), 1);
  // dynamic environment names fail closed outside worker-deploy.yml
  for (const environment of ["${{ format('worker-{0}', 'production') }}", { name: '${{ inputs.target }}' }]) {
    assert.equal(count('.github/workflows/ci.yml', wf({ environment })), 1);
  }
  assert.equal(count('.github/workflows/worker-deploy.yml', wf({ environment: 'worker-production' })), 0);
});

test('a removed hreflang backlink is reported even when every language label is present', () => {
  const origin = 'https://e.org';
  const alternates = (xDefault: string) =>
    `<link rel="alternate" hreflang="pt-BR" href="${origin}/pt-br/"><link rel="alternate" hreflang="en-US" href="${origin}/en-us/">` +
    `<link rel="alternate" hreflang="x-default" href="${origin}${xDefault}">`;
  const page = (self: string, links: string) => `<link rel="canonical" href="${origin}${self}">${links}`;
  const whole = new Map([['/pt-br/', page('/pt-br/', alternates('/en-us/'))], ['/en-us/', page('/en-us/', alternates('/en-us/'))]]);
  assert.equal(hreflangReciprocity(whole, origin).length, 0);
  // /en-us/ keeps all three labels but no longer links back to /pt-br/ (its pt-BR alternate points elsewhere).
  const noBacklink = new Map(whole).set(
    '/en-us/',
    page('/en-us/', `<link rel="alternate" hreflang="pt-BR" href="${origin}/pt-br/other/"><link rel="alternate" hreflang="en-US" href="${origin}/en-us/"><link rel="alternate" hreflang="x-default" href="${origin}/en-us/">`),
  );
  const findings = hreflangReciprocity(noBacklink, origin);
  assert.ok(findings.some((f) => f.file === '/pt-br/' && /not reciprocal/.test(f.message)), 'the page that lost its backlink is reported');
});
