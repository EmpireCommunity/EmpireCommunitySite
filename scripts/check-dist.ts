// Post-build scans (docs/contracts/site-data.md section 12, routing-locale sections 4 and 5).
// Usage: node scripts/check-dist.ts [distDir]   (run from the repository root; Node 24 runs TypeScript natively)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { parseEntryList } from '../src/lib/yaml-entries.ts';
import { formatRulesDate, inviteUrl } from '../src/lib/community-rules.ts';
import { CommunityRulesSchema } from '../src/schemas/community-rules.ts';
import { TeamMemberSchema } from '../src/schemas/team.ts';
import {
  analyticsBeacon, discordChooser, internalDiscordLinks, discordLinks, discordPage, gateCss, hasEffectiveDate, legalMarkdownHtml, headerLogoLink, hreflangReciprocity, htmlLang, inlineExecutable, languageSelector, mainContent, membersFallback, paymentGuard, paymentWords, personData, supportPage, donationsBlockElsewhere, openNeedsLegalTexts, reservedDonationsPath,
  staleDates, whatsappAbsent, whatsappInviteLink,
  type Finding,
} from './lib/dist-checks.ts';
import { PENDING } from './lib/pending.ts';
import { LOCALES, routePath, slugOf, type Locale } from '../src/lib/routes.ts';

const distDir = process.argv[2] ?? 'dist';
const ORIGIN = 'https://empirecommunity.org';
const TEXT_EXTENSIONS = /\.(html|txt|xml|json|webmanifest|js|svg)$/;
const LEGAL_SLUGS = ['terms-of-service', 'privacy-policy'];

const findings: Finding[] = [];
const add = (...items: Finding[]) => findings.push(...items);
const pending = (isPending: boolean, file: string, message: string): Finding => ({
  level: isPending ? 'warning' : 'error',
  file,
  message: isPending ? `${message} (pending in the scaffold, see scripts/lib/pending.ts)` : message,
});

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split('\\').join('/'));
}
const read = (dir: string, rel: string) => readFileSync(join(dir, rel), 'utf8');

if (!existsSync(distDir)) {
  console.error(`::error::${distDir}/ does not exist; run the build first.`);
  process.exit(1);
}

const site = parse(read('src/data', 'site.yaml')) as { contact?: Record<string, string>; discord?: { inviteCode?: string }; analytics?: { webAnalyticsToken?: string } };
const allowedEmails = new Set(Object.values(site.contact ?? {}).map((email) => email.toLowerCase()));
const inviteCode = site.discord?.inviteCode;
const webAnalyticsToken = site.analytics?.webAnalyticsToken;
if (webAnalyticsToken === undefined || webAnalyticsToken === '') {
  console.log('::error file=src/data/site.yaml::analytics.webAnalyticsToken is not set in src/data/site.yaml: the Web Analytics beacon cannot be checked (D-52)');
  process.exitCode = 1;
}
// Only `analyticsBeacon` gets the empty fallback; the error above already fails the run.
const beaconToken = webAnalyticsToken ?? '';

const files = listFiles(distDir);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const localePages = htmlFiles.filter((file) => /^(pt-br|en-us)\//.test(file) && file.endsWith('/index.html'));

// Brand set (D-40, D-42): the files the head links and the Open Graph image point to are built.
for (const file of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-image.png']) {
  if (!files.includes(file)) add({ level: 'error', file, message: 'brand file is not built (public/)' });
}

// C-3: the same pages exist in both locales.
const stripLocale = (file: string) => file.replace(/^(pt-br|en-us)\//, '');
for (const locale of ['pt-br', 'en-us']) {
  const other = locale === 'pt-br' ? 'en-us' : 'pt-br';
  const have = new Set(localePages.filter((f) => f.startsWith(`${other}/`)).map(stripLocale));
  for (const page of localePages.filter((f) => f.startsWith(`${locale}/`))) {
    if (!have.has(stripLocale(page))) add({ level: 'error', file: page, message: `no ${other} counterpart (C-3)` });
  }
}

// C-5: no inline executable script or style; hreflang reciprocity and canonical on locale pages.
for (const file of htmlFiles) add(...inlineExecutable(read(distDir, file), file));
const pageMap = new Map(localePages.map((file) => [`/${file.replace(/index\.html$/, '')}`, read(distDir, file)] as const));
// x-default of the home pages is the root chooser page (not a locale page, so no reciprocity is asked of it).
add(...hreflangReciprocity(pageMap, ORIGIN, new Set(files.includes('index.html') ? ['/'] : [])));

// WCAG 3.1.1 and the language selector (routing-locale sections 1 to 3): locale pages carry their locale and a selector
// to the equivalent page; the chooser, the 404 and /discord are en-US.
for (const file of localePages) {
  const [locale, ...rest] = file.replace(/index\.html$/, '').split('/');
  const html = read(distDir, file);
  add(...htmlLang(html, file, locale === 'pt-br' ? 'pt-BR' : 'en-US'));
  add(...languageSelector(html, file, locale === 'pt-br' ? 'pt-br' : 'en-us', rest.join('/')));
  add(...headerLogoLink(html, file, `/${locale}/`));
}
if (!files.includes('404.html')) add({ level: 'error', file: '404.html', message: 'the 404 page is not built' });
for (const file of ['index.html', '404.html', 'discord/index.html'].filter((f) => files.includes(f))) {
  const html = read(distDir, file);
  add(...htmlLang(html, file, 'en-US'));
  add(...headerLogoLink(html, file, '/'));
}

// C-1: WhatsApp absent from en-US output, llms.txt, the root page and the legal pages of both locales.
const whatsappScope = files.filter(
  (file) => file.startsWith('en-us/') || file === 'llms.txt' || file === 'index.html' || file === 'discord/index.html' ||
    LEGAL_SLUGS.some((slug) => file.startsWith(`pt-br/${slug}/`)),
);
// The pt-BR legal pages are scanned on their own text (<main>): the pt-BR footer, shared on every page, lists WhatsApp.
for (const file of whatsappScope) {
  const html = read(distDir, file);
  add(...whatsappAbsent(file.startsWith('pt-br/') ? mainContent(html) : html, file));
}
for (const file of listFiles('src/content/legal')) add(...whatsappAbsent(read('src/content/legal', file), `src/content/legal/${file}`));

// D-41: the WhatsApp community link is read only by the /discord page.
// Stylesheets are scanned here too (a URL in `content:` or `url()` would publish the link); the other scans keep TEXT_EXTENSIONS.
for (const file of files.filter((f) => TEXT_EXTENSIONS.test(f) || f.endsWith('.css'))) {
  add(...whatsappInviteLink(read(distDir, file), file, file === 'pt-br/discord/index.html'));
}

// C-4: personal data of team.yaml appears only inside validated person blocks.
// Same list parser and schema as the `team` collection, so a non-list or a bad entry fails naming the file.
const TEAM_FILE = 'src/data/team.yaml';
const team = parseEntryList(read('src/data', 'team.yaml'), TEAM_FILE).map((entry) => {
  const result = TeamMemberSchema.safeParse(entry);
  if (!result.success) throw new Error(`${TEAM_FILE}: entry "${entry.id}" is invalid: ${result.error.message}`);
  return result.data;
});
const people = team.map((person) => ({
  id: person.id,
  names: [person.name, person.nickname].filter((name): name is string => typeof name === 'string' && name !== ''),
}));
for (const file of files.filter((f) => TEXT_EXTENSIONS.test(f))) add(...personData(read(distDir, file), file, people));

// Stale dates only warn (site-data section 12).
const dateOf = (text: string, ...path: string[]): string | undefined => {
  let node: unknown = parse(text);
  for (const key of path) node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  return typeof node === 'string' ? node : undefined;
};
add(...staleDates({
  whatsappAsOf: dateOf(read('src/data', 'community.yaml'), 'whatsapp', 'asOf'),
  supportVerifiedOn: dateOf(read('src/data', 'support.yaml'), 'verified', 'on'),
  reviewOns: team.map((person) => ({ id: person.id, on: person.consent.reviewOn })),
}, new Date()));

// D-78: localized rules gates, plus a neutral chooser at the public address.
const gateFiles = new Map<string, Locale>(LOCALES.map((locale) => [`${routePath(locale, 'discord').slice(1)}index.html`, locale] as const));
const rulesResult = CommunityRulesSchema.safeParse(parse(read('src/data', 'community-rules.yaml')));
if (!rulesResult.success) throw new Error(`src/data/community-rules.yaml is invalid: ${rulesResult.error.message}`);
const rules = rulesResult.data;
const channels = parse(read('src/data', 'join-channels.yaml')) as { id: string; url?: string }[];
const whatsappUrl = channels.find((channel) => channel.id === 'whatsapp')?.url ?? '';
for (const file of [...gateFiles.keys(), 'discord/index.html']) {
  if (!files.includes(file)) add(pending(PENDING.discordPage, file, 'the gate page or chooser is not built'));
}
for (const file of htmlFiles) {
  const locale = gateFiles.get(file);
  const html = read(distDir, file);
  if (locale && inviteCode === undefined) add(pending(PENDING.discordPage, 'src/data/site.yaml', 'discord.inviteCode is not set'));
  else add(...discordLinks(html, file, inviteCode ?? '', locale !== undefined));
  if (/^(pt-br|en-us)\//.test(file)) add(...internalDiscordLinks(html, file, file.startsWith('pt-br/') ? 'pt-br' : 'en-us'));
  if (locale && inviteCode !== undefined) {
    add(...discordPage(html, file, {
      locale, inviteUrl: inviteUrl(inviteCode), whatsappUrl, date: formatRulesDate(rules.updatedOn, locale),
      rules: rules.rules.map((rule) => ({ title: rule.title[locale], body: rule.body[locale] })),
      closing: rules.closing?.[locale],
    }));
    const stylesheets = [...html.matchAll(/<link\b[^>]*>/gi)]
      .filter((tag) => /\brel=["']?stylesheet\b/i.test(tag[0]))
      .flatMap((tag) => /\bhref=["']?\/([^"'\s>?#]+\.css)/i.exec(tag[0])?.[1] ?? [])
      .filter((href) => files.includes(href));
    if (stylesheets.length === 0) add({ level: 'error', file, message: 'no built stylesheet linked for gate CSS validation' });
    else add(...gateCss(stylesheets.map((href) => read(distDir, href)).join('\n'), stylesheets.join(', ')));
  }
}
if (files.includes('discord/index.html')) {
  add(...discordChooser(read(distDir, 'discord/index.html'), 'discord/index.html', rules.rules.flatMap((rule) => LOCALES.flatMap((locale) => [rule.title[locale], rule.body[locale]]))));
}
// Invite values and the WhatsApp group have one source each; generated URLs must never be copied elsewhere.
for (const dir of ['src', 'scripts']) {
  for (const file of listFiles(dir).filter((name) => /\.(?:astro|ts|js|json|yaml|md|css)$/.test(name))) {
    const path = `${dir}/${file}`;
    const text = read(dir, file);
    if (path !== 'src/data/site.yaml' && inviteCode && text.includes(inviteCode)) add({ level: 'error', file: path, message: 'copied Discord invite code outside site.yaml' });
    if (path !== 'src/data/join-channels.yaml' && whatsappUrl && text.includes(whatsappUrl)) add({ level: 'error', file: path, message: 'copied WhatsApp community URL outside join-channels.yaml' });
  }
}

// D-52: the Web Analytics beacon on every locale page except Apoiar, and on no other page (root chooser, 404, /discord).
for (const file of htmlFiles) {
  const expected = localePages.includes(file) && !/^(pt-br|en-us)\/(?:support|discord)\//.test(file);
  add(...analyticsBeacon(read(distDir, file), file, expected, beaconToken));
}

// D-28, P2-09: support pages carry one donations block in the state the site data asks for (`not-open` until the opening,
// P2-12; `open` is the form that posts to the donations service); the payment guard runs on dist/ and on the content sources.
const supportData = parse(read('src/data', 'support.yaml')) as { donations?: { status?: unknown } };
const donationsStatus = supportData.donations?.status;
if (donationsStatus !== 'not-open' && donationsStatus !== 'open') {
  add({ level: 'error', file: 'src/data/support.yaml', message: 'donations.status must be "not-open" or "open"' });
}
// Opening needs the legal texts first (donations contract section 10: Privacy and Terms get a new version and effective date).
add(...openNeedsLegalTexts(donationsStatus === 'open', PENDING.legalPages));
const supportFiles = new Set<string>();
for (const locale of ['pt-br', 'en-us']) {
  const file = `${locale}/support/index.html`;
  supportFiles.add(file);
  if (!files.includes(file)) {
    add({ level: 'error', file, message: 'the support page is not built' });
    continue;
  }
  const messages = JSON.parse(read('src/i18n/messages', `${locale}.json`)) as Record<string, string>;
  const notOpenMessage = messages['support.donations.notOpen'] ?? '';
  add(...supportPage(read(distDir, file), file, { status: donationsStatus === 'open' ? 'open' : 'not-open', notOpenMessage, locale }));
}
// `/donations/` belongs to the donations service (routing-locale, reserved paths): the site builds nothing under it.
add(...reservedDonationsPath(files));
for (const file of htmlFiles.filter((f) => !supportFiles.has(f))) add(...donationsBlockElsewhere(read(distDir, file), file));
for (const file of files.filter((f) => TEXT_EXTENSIONS.test(f))) {
  const text = read(distDir, file);
  add(...paymentGuard(text, file, allowedEmails));
  if (file.endsWith('.html')) add(...paymentWords(text, file));
}
for (const dir of ['src/data', 'src/content', 'src/i18n/messages']) {
  for (const file of listFiles(dir)) add(...paymentGuard(read(dir, file), `${dir}/${file}`, allowedEmails));
}

// Legal pages (site-data section 11): the four pages need a built page, their Markdown text and, from the launch PR on, an
// `effectiveDate` (D-51: the launch date, the same in all four files). While `PENDING.legalPages` is true each gap only warns,
// which keeps the release guard shut; once it is false the same gaps are errors. The Markdown carries no raw HTML.
for (const locale of ['pt-br', 'en-us'] as const) {
  for (const key of ['terms', 'privacy'] as const) {
    const page = `${routePath(locale, key).slice(1)}index.html`;
    const source = `${locale}/${slugOf(key)}.md`;
    const sourcePath = `src/content/legal/${source}`;
    if (!files.includes(page)) add(pending(PENDING.legalPages, page, 'the legal page is not built'));
    if (!existsSync(sourcePath)) {
      add(pending(PENDING.legalPages, sourcePath, 'the legal text is missing, the page is a placeholder'));
      continue;
    }
    const markdown = read('src/content/legal', source);
    add(...legalMarkdownHtml(markdown, sourcePath));
    if (!hasEffectiveDate(markdown)) add(pending(PENDING.legalPages, sourcePath, 'effectiveDate is not set (the launch PR sets the launch date in all four files)'));
  }
}

// Origin fallback of the member count (members-json section 4).
if (!files.includes('data/members.json')) {
  add(pending(PENDING.membersFallback, 'data/members.json', 'the member-count fallback is not generated by the build'));
} else {
  add(...membersFallback(read(distDir, 'data/members.json'), 'data/members.json'));
}

// Discovery files (routing-locale section 5).
for (const file of ['sitemap-index.xml', 'sitemap-0.xml', 'robots.txt', 'llms.txt']) {
  if (!files.includes(file)) add(pending(PENDING.discoveryFiles, file, 'not built'));
}
if (files.includes('sitemap-0.xml')) {
  const sitemap = read(distDir, 'sitemap-0.xml');
  for (const url of [...pageMap.keys()].filter((path) => !LOCALES.some((locale) => path === routePath(locale, 'discord')))) {
    if (!sitemap.includes(`<loc>${ORIGIN}${url}</loc>`)) add({ level: 'error', file: 'sitemap-0.xml', message: `missing ${url}` });
  }
  for (const excluded of ['/', '/404.html', '/discord/', ...LOCALES.map((locale) => routePath(locale, 'discord'))]) {
    if (sitemap.includes(`<loc>${ORIGIN}${excluded}</loc>`)) add({ level: 'error', file: 'sitemap-0.xml', message: `must not list ${excluded}` });
  }
}
if (files.includes('robots.txt') && !read(distDir, 'robots.txt').includes(`Sitemap: ${ORIGIN}/sitemap-index.xml`)) {
  add({ level: 'error', file: 'robots.txt', message: 'missing the Sitemap line' });
}

if (files.includes('robots.txt')) {
  const robots = read(distDir, 'robots.txt');
  if (!/^User-agent: \*$/m.test(robots) || !/^Allow: \/$/m.test(robots)) add({ level: 'error', file: 'robots.txt', message: 'expected "User-agent: *" and "Allow: /"' });
  if (/^Disallow:/m.test(robots)) add({ level: 'error', file: 'robots.txt', message: 'nothing is disallowed (routing-locale section 5)' });
}
if (files.includes('llms.txt')) {
  // English file that links the en-US pages only (routing-locale section 5).
  for (const url of read(distDir, 'llms.txt').match(/https?:\/\/[^\s)]+/g) ?? []) {
    if (!url.startsWith(`${ORIGIN}/en-us/`) || url === `${ORIGIN}${routePath('en-us', 'discord')}`) add({ level: 'error', file: 'llms.txt', message: `links outside the en-US pages: ${url}` });
  }
}

for (const finding of findings) {
  console.log(`::${finding.level} file=${finding.file}::${finding.message}`);
}
const errors = findings.filter((f) => f.level === 'error').length;
const warnings = findings.length - errors;
console.log(`check-dist: ${files.length} files scanned, ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors > 0 ? 1 : 0);
