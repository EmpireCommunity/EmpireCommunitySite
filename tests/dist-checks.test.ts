import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  discordLinks, hreflangReciprocity, htmlLang, mainContent, inlineExecutable, languageSelector, membersFallback, paymentGuard, personData, whatsappAbsent, whatsappInviteLink,
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
  const ok = new Map([['/pt-br/', head('/pt-br/', '/')], ['/en-us/', head('/en-us/', '/')]]);
  assert.equal(hreflangReciprocity(ok, origin, new Set(['/'])).length, 0);
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
    `<link rel="alternate" hreflang="x-default" href="${origin}/">`;
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
  const whole = new Map([['/pt-br/', page('/pt-br/', alternates('/'))], ['/en-us/', page('/en-us/', alternates('/'))]]);
  assert.equal(hreflangReciprocity(whole, origin, new Set(['/'])).length, 0);
  // /en-us/ keeps all three labels but no longer links back to /pt-br/ (its pt-BR alternate points elsewhere).
  const noBacklink = new Map(whole).set(
    '/en-us/',
    page('/en-us/', `<link rel="alternate" hreflang="pt-BR" href="${origin}/pt-br/other/"><link rel="alternate" hreflang="en-US" href="${origin}/en-us/"><link rel="alternate" hreflang="x-default" href="${origin}/">`),
  );
  const findings = hreflangReciprocity(noBacklink, origin);
  assert.ok(findings.some((f) => f.file === '/pt-br/' && /not reciprocal/.test(f.message)), 'the page that lost its backlink is reported');
});

test('regressions of the PR 4 re-review: first duplicate attribute, x-default targets', () => {
  // browsers use the first of two identical attributes
  assert.equal(inlineExecutable('<script type="application/ld+json" type="text/javascript">{}</script>', 'p').length, 0);
  assert.equal(inlineExecutable('<script type="text/javascript" type="application/ld+json">run()</script>', 'p').length, 1);
  // x-default is / on a home page and the en-US page on an inner page
  const origin = 'https://e.org';
  const links = (route: string, xDefault: string) =>
    `<link rel="canonical" href="${origin}/pt-br/${route}"><link rel="alternate" hreflang="pt-BR" href="${origin}/pt-br/${route}">` +
    `<link rel="alternate" hreflang="en-US" href="${origin}/en-us/${route}"><link rel="alternate" hreflang="x-default" href="${origin}${xDefault}">`;
  const en = (route: string) =>
    `<link rel="canonical" href="${origin}/en-us/${route}"><link rel="alternate" hreflang="pt-BR" href="${origin}/pt-br/${route}">` +
    `<link rel="alternate" hreflang="en-US" href="${origin}/en-us/${route}"><link rel="alternate" hreflang="x-default" href="${origin}${route === '' ? '/' : `/en-us/${route}`}">`;
  const pair = (route: string, xDefault: string) => new Map([[`/pt-br/${route}`, links(route, xDefault)], [`/en-us/${route}`, en(route)]]);
  assert.equal(hreflangReciprocity(pair('', '/'), origin, new Set(['/'])).length, 0);
  assert.equal(hreflangReciprocity(pair('projects/', '/en-us/projects/'), origin).length, 0);
  for (const [route, wrong] of [['', '/en-us/'], ['projects/', '/'], ['projects/', '/pt-br/projects/']] as const) {
    assert.ok(hreflangReciprocity(pair(route, wrong), origin, new Set(['/'])).length > 0, `${route} ${wrong}`);
  }
});

test('regressions of the PR 4 re-review: workflow rules', () => {
  const pin = 'x/y@' + 'a'.repeat(40);
  const wf = (over: object, step: object = { uses: pin }) =>
    ({ on: 'push', permissions: {}, jobs: { a: { 'timeout-minutes': 1, steps: [step], ...over } } });
  const count = (file: string, workflow: object) => checkWorkflow(file, workflow as never).length;
  // branch names are attacker-controlled too
  for (const expr of ['github.ref_name', 'github.base_ref', 'github.head_ref', 'github.ref']) {
    assert.equal(count('w', wf({}, { run: `echo \${{ ${expr} }}` })), 1, expr);
  }
  // no usable on key fails closed; a key parsed as boolean true is read as on
  const noOn: Record<string, unknown> = { ...wf({}) };
  delete noOn.on;
  assert.equal(count('w', noOn), 1);
  assert.equal(count('w', { ...noOn, on: null }), 1);
  assert.equal(count('w', { ...noOn, true: 'push' }), 0);
  assert.equal(count('w', { ...noOn, true: { pull_request_target: {} } }), 1);
  // the protected environment name is matched case-insensitively
  assert.equal(count('.github/workflows/ci.yml', wf({ environment: 'Worker-Production' })), 1);
});

test('html lang must match the page: a locale for locale pages, en-US for the neutral pages', () => {
  assert.equal(htmlLang('<!doctype html><html lang="en-US"><head>', 'index.html', 'en-US').length, 0);
  assert.equal(htmlLang('<html>', 'index.html', 'en-US').length, 1);
  assert.equal(htmlLang('<html lang="pt-BR">', 'en-us/index.html', 'en-US').length, 1);
});

test('the language selector maps each page to its equivalent and marks only the current locale', () => {
  const pt = '<a href="/pt-br/join/" hreflang="pt-BR" lang="pt-BR" aria-current="true">Português</a>';
  const en = '<a href="/en-us/join/" hreflang="en-US" lang="en-US">English</a>';
  const nav = (...links: string[]) => `<nav aria-label="Idioma">${links.join('')}</nav>`;
  const check = (html: string) => languageSelector(html, 'p', 'pt-br', 'join/').length;

  assert.equal(check(nav(pt, en)), 0);
  assert.equal(check(nav(pt, en) + nav(pt, en)), 0, 'one selector per breakpoint is fine when each is correct');
  assert.equal(check(nav(pt, en.replace('/en-us/join/', '/en-us/'))), 1, 'wrong target');
  assert.equal(check(nav(pt.replace(' aria-current="true"', ''), en)), 1, 'current link not marked');
  assert.equal(check(nav(pt)), 1, 'missing locale');
  assert.equal(check(nav(pt, en.replace(' lang="en-US"', ''))), 1, 'missing lang attribute');
  assert.equal(check(nav(pt, en.replace('aria-current', 'x').replace('<a ', '<a aria-current="page" '))), 1, 'aria-current on the other locale');
  assert.equal(check(nav(pt, en, en)), 1, 'duplicate locale in one selector');
  assert.equal(check(nav(pt, en, pt.replace('hreflang="pt-BR"', 'hreflang="pt-br"'))), 1, 'unsupported hreflang value');
  assert.equal(check(nav(pt, en) + nav(pt)), 1, 'a second selector is checked on its own');
  assert.equal(check('<p>no selector</p>'), 1, 'no selector at all');
});

test('the WhatsApp community link is allowed only on the /discord page', () => {
  const link = '<a href="https://chat.whatsapp.com/abc">';
  assert.equal(whatsappInviteLink(link, 'discord/index.html', true).length, 0);
  assert.equal(whatsappInviteLink(link, 'pt-br/join/index.html', false).length, 1);
  assert.equal(whatsappInviteLink('<a href="https://empirecommunity.org/discord">WhatsApp</a>', 'pt-br/index.html', false).length, 0);
  for (const encoded of ['chat&#46;whatsapp.com', 'chat&#x2E;whatsapp.com', 'chat&period;whatsapp.com', 'chat&#46whatsapp.com']) {
    assert.equal(whatsappInviteLink(`<a href="https://${encoded}/abc">`, 'pt-br/join/index.html', false).length, 1, encoded);
  }
});

test('check-dist reports D-41 for an invite outside /discord, in HTML and in CSS, and none for the /discord page', () => {
  const dist = mkdtempSync(join(tmpdir(), 'check-dist-'));
  const link = '<a href="https://chat.whatsapp.com/abc">';
  try {
    const fixture: Record<string, string> = {
      'pt-br/join/index.html': link,
      'assets/site.css': 'a::after{content:"https://chat.whatsapp.com/abc"}',
      'discord/index.html': link,
    };
    for (const [file, body] of Object.entries(fixture)) {
      mkdirSync(dirname(join(dist, file)), { recursive: true });
      writeFileSync(join(dist, file), body);
    }
    const out = spawnSync(process.execPath, ['scripts/check-dist.ts', dist], { encoding: 'utf8' }).stdout;
    const d41 = out.split('\n').filter((line) => line.includes('(D-41)'));
    assert.deepEqual(d41.map((line) => /file=([^:]+)::/.exec(line)?.[1]).sort(), ['assets/site.css', 'pt-br/join/index.html']);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('legal pages are scanned on their <main> only, so the shared pt-BR footer may list the channel', () => {
  const page = '<footer>WhatsApp</footer><main><p>texto legal</p></main>';
  assert.equal(whatsappAbsent(mainContent(page), 'pt-br/terms-of-service/index.html').length, 0);
  assert.equal(whatsappAbsent(mainContent('<main>WhatsApp</main>'), 'f').length, 1);
  assert.equal(mainContent('no main here'), 'no main here');
});

test('team data: a marker without an entry fails, and a name outside its person block fails', () => {
  const people = [{ id: 'p-3f9a1c7d2b40', names: ['Ana Souza', 'Aninha'] }];
  const block = '<article data-person-id="p-3f9a1c7d2b40"><p>Ana Souza “Aninha”</p></article>';
  assert.equal(personData(`<main>${block}</main>`, 'x.html', people).length, 0);
  assert.equal(personData('<article data-person-id="p-aaaaaaaaaaaa"></article>', 'x.html', people).length, 1, 'unknown id');
  assert.equal(personData(`${block}<footer>Ana Souza</footer>`, 'x.html', people).length, 1, 'name outside the block');
  assert.equal(personData('<p>Aninhas</p>', 'x.html', people).length, 0, 'whole words only');
  assert.equal(personData('<main>no team</main>', 'x.html', []).length, 0);
});
