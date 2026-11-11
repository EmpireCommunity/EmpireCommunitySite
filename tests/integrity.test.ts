import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SITE_ORIGIN, WORKER_CONFIG_URL, discordEntry, discordRetryDelay, findingLevel, inviteLookup, inviteGuild, inviteLinks,
  liveMembers, noPayment, publicDestination, publicHeaders, rewriting, rootRedirect, sitemapUrls, siteUrl,
  workerCopies, type PublicResponse,
} from '../scripts/lib/integrity-rules.ts';

const snapshot = (text = '', status = 200, headers: Record<string, string> = {}): PublicResponse => ({ text, status, headers: new Headers(headers) });
const now = Date.parse('2026-11-12T00:00:00Z');
const invite = 'approved-invite';
const guild = '1010657521775681556';
const entry = (code = invite) => ['pt-BR', 'en-US'].map((lang) =>
  `<section lang="${lang}"><p>Read https://discord.com/terms</p><a href="https://discord.com/invite/${code}">Join</a></section>`).join('');

test('launch flags downgrade pending rows only; the active decision remains blocking', () => {
  assert.equal(findingLevel(true), 'warning');
  assert.equal(findingLevel(false), 'error');
});

test('HTTP destinations are restricted to the site and the two approved public reads', () => {
  for (const url of [`${SITE_ORIGIN}/data/members.json`, `${SITE_ORIGIN}/?utm_source=ci`, `${SITE_ORIGIN}/discord?utm_source=ci`,
    WORKER_CONFIG_URL, `https://discord.com/api/v10/invites/${invite}?with_counts=true`]) assert.doesNotThrow(() => publicDestination(url));
  for (const url of ['https://example.com/', 'http://empirecommunity.org/', `${SITE_ORIGIN}/data/members.json?x=1`,
    `${SITE_ORIGIN}/d%61ta/members.json`, `${SITE_ORIGIN}/data/other.json`, `${SITE_ORIGIN}/pt-br/?x=1`,
    'https://discordXcom/api/v10/invites/abc?with_counts=true', 'https://discord.com/api/v10/invites/abc?token=x',
    WORKER_CONFIG_URL.replace('/main/', '/other/'), `${SITE_ORIGIN}/#fragment`, 'https://user:pass@empirecommunity.org/']) {
    assert.throws(() => publicDestination(url), Error, url);
  }
});

test('sitemap discovery permits bounded same-origin URLs only and never discovers data probes', () => {
  assert.deepEqual(sitemapUrls(`<urlset><url><loc>${SITE_ORIGIN}/pt-br/</loc></url><url><loc>${SITE_ORIGIN}/pt-br/</loc></url></urlset>`), [`${SITE_ORIGIN}/pt-br/`]);
  for (const input of ['<html></html>', '<urlset></urlset>', `<urlset>${'<loc>/pt-br/</loc>'.repeat(101)}</urlset>`,
    '<urlset><loc>https://example.com/</loc></urlset>', '<urlset><loc>/data/members.json?x=1</loc></urlset>']) assert.throws(() => sitemapUrls(input));
  for (const url of ['/data/members.json', '/%64ata/members.json', '/pt-br/?x=1', '//example.com/', '/pt-br/#a']) assert.throws(() => siteUrl(url));
});

test('Discord entry derives one consistent invite per language without comparing deployed copy to main', () => {
  const result = discordEntry(snapshot(entry('released-code')));
  assert.equal(result.code, 'released-code');
  assert.deepEqual(result.problems, []);
  const bad = [
    snapshot(entry(), 302, { location: '/elsewhere' }), snapshot(entry(), 200, { location: '/elsewhere' }),
    snapshot(entry().replace('en-US', 'pt-BR')), snapshot(entry().replace(invite, 'different-invite')),
    snapshot(`${entry()}<script src="/script.js"></script>`), snapshot(`${entry()}<meta http-equiv="refresh" content="0;url=/">`),
    snapshot(`${entry()}<a href="https://discord.gg/other">bad</a>`), snapshot(`${entry()}<a href="https://discord.com/invite/${invite}">extra</a>`),
    snapshot(entry().replace('href=', 'data-href=')), snapshot(entry().replace('https://discord.com/terms', '<a href="https://discord.com/terms">terms</a>')),
  ];
  for (const response of bad) assert.ok(discordEntry(response).problems.length > 0);
  assert.ok(inviteLinks('<a href="https://discord&#46;com/invite/stale-code">go</a>', invite, false).length > 0);
  assert.deepEqual(inviteLinks('<a href="https://empirecommunity.org/discord">go</a>', invite, false), []);
});

test('payment blocks are support-only; released wording may vary, payment markers never pass', () => {
  const block = '<p data-donations="not-open">Donations are not open.</p>';
  assert.deepEqual(noPayment(block, true), []);
  assert.deepEqual(noPayment('contact@empirecommunity.org', false), []);
  for (const html of ['', block + block, '<p data-donations="not-open"><a href="/">go</a></p>']) assert.ok(noPayment(html, true).length > 0);
  assert.ok(noPayment(block, false).length > 0);
  for (const marker of ['data-pix', 'https://mpago.la/x', 'BR.GOV.BCB.PIX', 'someone@example.com',
    '123e4567-e89b-42d3-a456-426614174000', '123.456.789-09', '12.345.678/0001-95']) assert.ok(noPayment(marker, false).length > 0);
});

test('support rewriting markers fail while ordinary HTML passes', () => {
  assert.deepEqual(rewriting('<p>Public support text.</p>'), []);
  for (const marker of ['data-cfemail', '/cdn-cgi/l/email-protection', 'rocket-loader', 'text/rocketscript', 'data-cf-beacon']) assert.ok(rewriting(marker).length > 0);
});

test('root requires a temporary non-Brazilian redirect with its query preserved', () => {
  assert.deepEqual(rootRedirect(snapshot('', 302, { location: '/en-us/?utm_source=ci' })), []);
  for (const [status, location] of [[301, '/en-us/?utm_source=ci'], [200, '/en-us/?utm_source=ci'], [302, '/en-us/'],
    [302, '/pt-br/?utm_source=ci'], [302, 'https://example.com/en-us/?utm_source=ci'], [302, 'http://[bad']] as const) {
    assert.ok(rootRedirect(snapshot('', status, { location })).length > 0);
  }
});

test('live member schema, source and three-day freshness boundary use injected time', () => {
  const body = (updatedAt: unknown, source: unknown = 'discord-invite', members: unknown = 888) => JSON.stringify({ schema: 1, discord: { members, updatedAt, source }, extra: true });
  assert.deepEqual(liveMembers(body('2026-11-09T00:00:00Z'), now), []);
  assert.deepEqual(liveMembers(body('2026-11-11T23:59:00+00:00', 'empirebot'), now), []);
  for (const text of ['null', 'not json', '{"schema":2}', body('2026-11-08T23:59:59Z'), body('2026-11-12T00:00:00Z', 'built-in'),
    body('2026-11-12T00:00:00Z', 'unknown'), body('2026-02-30T00:00:00Z'), body('2026-11-12'), body('2026-11-12T24:00:00Z'),
    body('2026-11-12T00:00:00Z', 'discord-invite', '888')]) assert.ok(liveMembers(text, now).length > 0, text);
});

test('public header invariants detect missing headers, CSP changes, cookies and version disclosure', () => {
  const headers = {
    'content-security-policy': "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
    'cross-origin-opener-policy': 'same-origin', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin', 'strict-transport-security': 'max-age=31536000',
  };
  assert.deepEqual(publicHeaders(snapshot('', 200, headers), true), []);
  for (const [key, value] of [['content-security-policy', "default-src * 'unsafe-inline'"], ['set-cookie', 'tracking=1'], ['server', 'nginx/1.2']]) {
    assert.ok(publicHeaders(snapshot('', 200, { ...headers, [key!]: value! }), true).length > 0);
  }
  for (const key of Object.keys(headers)) {
    const response = snapshot('', 200, headers);
    response.headers.delete(key);
    assert.ok(publicHeaders(response, true).length > 0, key);
  }
  assert.ok(publicHeaders(snapshot('', 200, headers), false).length > 0);
});

test('Worker JSONC copies and public invite identity must match their configured guild and code', () => {
  const text = `{// public configuration\n"vars":{"DISCORD_INVITE_CODE":"${invite}","DISCORD_GUILD_ID":"${guild}"}}`;
  assert.deepEqual(workerCopies(text, invite, guild), []);
  for (const wrong of [text.replace(invite, 'other'), text.replace(guild, '999999999999999999'), '{}', 'invalid']) assert.ok(workerCopies(wrong, invite, guild).length > 0);
  const response = JSON.stringify({ code: invite, guild: { id: guild } });
  assert.deepEqual(inviteGuild(response, invite, guild), []);
  for (const wrong of [response.replace(invite, 'other'), response.replace(guild, '999999999999999999'), 'null', 'invalid']) assert.ok(inviteGuild(wrong, invite, guild).length > 0);
});

test('Discord retry decision respects Retry-After and never retries permanent failures or excessive waits', () => {
  const cases: [number, string | null, number | undefined][] = [
    [0, null, 1000], [503, null, 1000], [429, '0', 0], [429, '10', 10_000],
    [429, 'Thu, 12 Nov 2026 00:00:02 GMT', 2000], [429, null, undefined], [429, 'bad', undefined],
    [429, '61', undefined], [404, '1', undefined], [302, null, undefined],
  ];
  for (const [status, header, expected] of cases) assert.equal(discordRetryDelay(status, header, now), expected);
});


test('Discord rate limiting after the allowed retry warns; other invalid responses fail', () => {
  for (const status of [429, 404, 500, 200]) {
    const result = inviteLookup(snapshot('', status), invite, guild);
    assert.equal(result.level, status === 429 ? 'warning' : 'error');
    assert.ok(result.problems.length > 0);
  }
  assert.deepEqual(inviteLookup(snapshot(JSON.stringify({ code: invite, guild: { id: guild } })), invite, guild).problems, []);
});
