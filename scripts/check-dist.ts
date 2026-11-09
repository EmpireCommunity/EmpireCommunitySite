// Post-build scans (docs/contracts/site-data.md section 12, routing-locale sections 4 and 5).
// Usage: node scripts/check-dist.ts [distDir]   (run from the repository root; Node 24 runs TypeScript natively)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import {
  discordLinks, hreflangReciprocity, htmlLang, inlineExecutable, languageSelector, membersFallback, paymentGuard, paymentWords, whatsappAbsent,
  type Finding,
} from './lib/dist-checks.ts';
import { PENDING } from './lib/pending.ts';

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
for (const file of whatsappScope) add(...whatsappAbsent(read(distDir, file), file));
for (const file of listFiles('src/content/legal')) add(...whatsappAbsent(read('src/content/legal', file), `src/content/legal/${file}`));

// D-29: one Discord link; the invite only in /discord and only with the configured code, with no script.
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

// D-28: support pages carry the donations-not-open block; the payment guard runs on dist/ and on the content sources.
for (const locale of ['pt-br', 'en-us']) {
  const file = `${locale}/support/index.html`;
  if (!files.includes(file)) add(pending(PENDING.supportBlock, file, 'the support page is not built'));
  else if (!read(distDir, file).includes('data-donations="not-open"')) {
    add(pending(PENDING.supportBlock, file, 'missing the data-donations="not-open" block'));
  }
}
for (const file of files.filter((f) => TEXT_EXTENSIONS.test(f))) {
  const text = read(distDir, file);
  add(...paymentGuard(text, file, allowedEmails));
  if (file.endsWith('.html')) add(...paymentWords(text, file));
}
for (const dir of ['src/data', 'src/content', 'src/i18n/messages']) {
  for (const file of listFiles(dir)) add(...paymentGuard(read(dir, file), `${dir}/${file}`, allowedEmails));
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

for (const finding of findings) {
  console.log(`::${finding.level} file=${finding.file}::${finding.message}`);
}
const errors = findings.filter((f) => f.level === 'error').length;
const warnings = findings.length - errors;
console.log(`check-dist: ${files.length} files scanned, ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors > 0 ? 1 : 0);
