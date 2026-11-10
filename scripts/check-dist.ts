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
  discordLinks, discordPage, gateCss, hreflangReciprocity, htmlLang, inlineExecutable, languageSelector, mainContent, membersFallback, paymentGuard, paymentWords, personData, supportPage, donationsBlockElsewhere,
  whatsappAbsent, whatsappInviteLink,
  type Finding,
} from './lib/dist-checks.ts';
import { PENDING } from './lib/pending.ts';
import { routePath, slugOf } from '../src/lib/routes.ts';

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

const site = parse(read('src/data', 'site.yaml')) as { contact?: Record<string, string>; discord?: { inviteCode?: string } };
const allowedEmails = new Set(Object.values(site.contact ?? {}).map((email) => email.toLowerCase()));
const inviteCode = site.discord?.inviteCode;

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
}
if (!files.includes('404.html')) add({ level: 'error', file: '404.html', message: 'the 404 page is not built' });
for (const file of ['index.html', '404.html', 'discord/index.html'].filter((f) => files.includes(f))) {
  add(...htmlLang(read(distDir, file), file, 'en-US'));
}

// C-1: WhatsApp absent from en-US output, llms.txt, the root page and the legal pages of both locales.
const whatsappScope = files.filter(
  (file) => file.startsWith('en-us/') || file === 'llms.txt' || file === 'index.html' ||
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
  add(...whatsappInviteLink(read(distDir, file), file, file === 'discord/index.html'));
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

// D-29, D-41: one Discord link; the invite only in /discord and only with the configured code, with no script; the page
// structure (two language containers, one checkbox each, the join links after it) is checked against the data files.
const invitePage = 'discord/index.html';
if (!files.includes(invitePage)) {
  add(pending(PENDING.discordPage, invitePage, 'the /discord page is not built'));
}
for (const file of htmlFiles) {
  if (file === invitePage && inviteCode === undefined) {
    add(pending(PENDING.discordPage, 'src/data/site.yaml', 'discord.inviteCode is not set, the invite page cannot be checked'));
    continue;
  }
  add(...discordLinks(read(distDir, file), file, inviteCode ?? '', file === invitePage));
}
if (files.includes(invitePage) && inviteCode !== undefined) {
  const rulesResult = CommunityRulesSchema.safeParse(parse(read('src/data', 'community-rules.yaml')));
  if (!rulesResult.success) throw new Error(`src/data/community-rules.yaml is invalid: ${rulesResult.error.message}`);
  const rules = rulesResult.data;
  const channels = parse(read('src/data', 'join-channels.yaml')) as { id: string; url: string }[];
  const whatsappUrl = channels.find((channel) => channel.id === 'whatsapp')?.url ?? '';
  const html = read(distDir, invitePage);
  add(...discordPage(html, invitePage, {
    inviteUrl: inviteUrl(inviteCode),
    whatsappUrl,
    containers: {
      'pt-BR': { date: formatRulesDate(rules.updatedOn, 'pt-br'), titles: rules.rules.map((rule) => rule.title['pt-br']) },
      'en-US': { date: formatRulesDate(rules.updatedOn, 'en-us'), titles: rules.rules.map((rule) => rule.title['en-us']) },
    },
  }));
  // The linked stylesheets, whatever the attribute order; only files that exist in dist/, checked as one combined text.
  const stylesheets = [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter((tag) => /\brel=["']?stylesheet\b/i.test(tag[0]))
    .flatMap((tag) => /\bhref=["']?\/([^"'\s>?#]+\.css)/i.exec(tag[0])?.[1] ?? [])
    .filter((href) => files.includes(href));
  if (stylesheets.length === 0) add({ level: 'error', file: invitePage, message: 'no built stylesheet is linked: the gate CSS cannot be checked' });
  else add(...gateCss(stylesheets.map((href) => read(distDir, href)).join('\n'), stylesheets.join(', ')));
}

// D-28: support pages carry the donations-not-open block; the payment guard runs on dist/ and on the content sources.
const supportFiles = new Set<string>();
for (const locale of ['pt-br', 'en-us']) {
  const file = `${locale}/support/index.html`;
  supportFiles.add(file);
  if (!files.includes(file)) {
    add({ level: 'error', file, message: 'the support page is not built' });
    continue;
  }
  const messages = JSON.parse(read('src/i18n/messages', `${locale}.json`)) as Record<string, string>;
  const notOpen = messages['support.donations.notOpen'] ?? '';
  add(...supportPage(read(distDir, file), file, notOpen));
}
for (const file of htmlFiles.filter((f) => !supportFiles.has(f))) add(...donationsBlockElsewhere(read(distDir, file), file));
for (const file of files.filter((f) => TEXT_EXTENSIONS.test(f))) {
  const text = read(distDir, file);
  add(...paymentGuard(text, file, allowedEmails));
  if (file.endsWith('.html')) add(...paymentWords(text, file));
}
for (const dir of ['src/data', 'src/content', 'src/i18n/messages']) {
  for (const file of listFiles(dir)) add(...paymentGuard(read(dir, file), `${dir}/${file}`, allowedEmails));
}

// Legal pages (site-data section 11): the four pages need a built page and their Markdown text. Until the owner's texts
// land the routes build as title-only placeholders, so the missing text counts as missing; this keeps the release guard shut.
const legalSources = new Set(listFiles('src/content/legal'));
for (const locale of ['pt-br', 'en-us'] as const) {
  for (const key of ['terms', 'privacy'] as const) {
    const page = `${routePath(locale, key).slice(1)}index.html`;
    const source = `${locale}/${slugOf(key)}.md`;
    if (!files.includes(page)) add(pending(PENDING.legalPages, page, 'the legal page is not built'));
    else if (!legalSources.has(source)) add(pending(PENDING.legalPages, `src/content/legal/${source}`, 'the legal text is missing, the page is a placeholder'));
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
  for (const url of pageMap.keys()) {
    if (!sitemap.includes(`<loc>${ORIGIN}${url}</loc>`)) add({ level: 'error', file: 'sitemap-0.xml', message: `missing ${url}` });
  }
  for (const excluded of ['/', '/404.html', '/discord/']) {
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
    if (!url.startsWith(`${ORIGIN}/en-us/`)) add({ level: 'error', file: 'llms.txt', message: `links outside the en-US pages: ${url}` });
  }
}

for (const finding of findings) {
  console.log(`::${finding.level} file=${finding.file}::${finding.message}`);
}
const errors = findings.filter((f) => f.level === 'error').length;
const warnings = findings.length - errors;
console.log(`check-dist: ${files.length} files scanned, ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors > 0 ? 1 : 0);
