import { HTML_LANG, LOCALES, routePath, type Locale } from '../../src/lib/routes.ts';

// Pure checks over the built site (docs/contracts/site-data.md section 12, routing-locale sections 4 and 6).
// Each function takes text and returns findings; scripts/check-dist.ts reads the files and prints them.

export type Finding = { level: 'error' | 'warning'; file: string; message: string };

export const err = (file: string, message: string): Finding => ({ level: 'error', file, message });
const warn = (file: string, message: string): Finding => ({ level: 'warning', file, message });

/** Attribute names (lower-cased, exact) and values of one tag's attribute text: `data-src` is not `src`; the first duplicate wins. */
export function attributesOf(text: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const m of text.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const name = (m[1] ?? '').toLowerCase();
    if (!attrs.has(name)) attrs.set(name, m[2] ?? m[3] ?? m[4] ?? ''); // browsers keep the FIRST of a duplicate attribute
  }
  return attrs;
}

/** Inline executable script, `<style>`, `style=` and event-handler attributes break the strict CSP (no unsafe-inline). */
export function inlineExecutable(html: string, file: string): Finding[] {
  const findings: Finding[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = attributesOf(match[1] ?? '');
    const isData = attrs.get('type')?.toLowerCase() === 'application/ld+json';
    if (!attrs.has('src') && !isData) findings.push(err(file, 'inline executable <script>'));
  }
  if (/<style\b/i.test(html)) findings.push(err(file, 'inline <style> element'));
  for (const tag of html.matchAll(/<[a-z][^>]*>/gi)) {
    if (/\sstyle\s*=/i.test(tag[0])) findings.push(err(file, `style attribute in ${tag[0].slice(0, 60)}`));
    if (/\son[a-z]+\s*=/i.test(tag[0])) findings.push(err(file, `inline event handler in ${tag[0].slice(0, 60)}`));
  }
  return findings;
}

/**
 * The `<main>` of a page, or the whole text when there is none. The legal pages are scanned for WhatsApp on their own
 * text only: the pt-BR footer is shared chrome that lists the channel (information-architecture section 4).
 */
export function mainContent(html: string): string {
  return /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
}

const WHATSAPP = /whats\s?app|\bwa\.me\b|api\.whatsapp\.com/i;

/** C-1: WhatsApp never appears in en-US output, llms.txt, the root page or the legal pages. */
export function whatsappAbsent(text: string, file: string): Finding[] {
  return WHATSAPP.test(text) ? [err(file, 'WhatsApp reference where the contract forbids it (C-1)')] : [];
}

/** Character references that spell a URL host in an attribute: numeric (`&#46;`, `&#x2e;`) and the few named ones for `.`, `/` and `:`. */
const NAMED_REFERENCES: Record<string, string> = { period: '.', sol: '/', colon: ':', amp: '&' };
function decodeReferences(text: string): string {
  return text.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-z]+));?/g, (whole, dec?: string, hex?: string, name?: string) => {
    const code = dec !== undefined ? Number(dec) : hex !== undefined ? parseInt(hex, 16) : undefined;
    if (code !== undefined) return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    return NAMED_REFERENCES[name ?? ''] ?? whole;
  });
}

/**
 * The WhatsApp community link is read only by the pt-BR gate page (site-data section 8, D-41): nowhere else in `dist/`. The
 * host alone fails too (fail closed: it has no other use on the site), and so does an entity-encoded one, which a browser
 * resolves to the same host (`chat&#46;whatsapp.com`).
 */
export function whatsappInviteLink(text: string, file: string, isInvitePage: boolean): Finding[] {
  return !isInvitePage && /chat\.whatsapp\.com/i.test(decodeReferences(text)) ? [err(file, 'the WhatsApp community link may appear only on the pt-BR gate page (D-41, D-78)')] : [];
}

const PERSON_BLOCK = /<article\b[^>]*\bdata-person-id=[^>]*>[\s\S]*?<\/article>/gi;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Team data is personal data (site-data section 9, C-4). Every `data-person-id` in a page must be an id of a validated
 * `team.yaml` entry, and no name or nickname of that file may appear outside such a block.
 */
export function personData(text: string, file: string, people: readonly { id: string; names: readonly string[] }[]): Finding[] {
  const findings: Finding[] = [];
  const known = new Set(people.map((person) => person.id));
  for (const match of text.matchAll(/\bdata-person-id="([^"]*)"/g)) {
    if (!known.has(match[1] ?? '')) findings.push(err(file, `person marker ${match[1]} has no entry in team.yaml (C-4)`));
  }
  const outside = text.replace(PERSON_BLOCK, '');
  for (const name of people.flatMap((person) => person.names)) {
    if (new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'u').test(outside)) {
      findings.push(err(file, 'a name or nickname of team.yaml appears outside a person block (C-4)'));
    }
  }
  return findings;
}

const DISCORD_URL = /(?:https?:)?\/\/(?:[a-z0-9-]+\.)*discord(?:app)?\.(?:com|gg)(?:\/[^\s"'<>)]*)?/gi;

/** The one Discord address a rule may carry as plain text (site-data section 14, the Terms URL exception of section 12). */
const TERMS_URL = 'https://discord.com/terms';

/**
 * A URL on a Discord host appears only in the two locale gates (D-78), as the configured invite or the Terms URL as
 * plain text, at most once per page. Gate pages have no script; internal button destinations are checked separately.
 */
export function discordLinks(html: string, file: string, inviteCode: string, isInvitePage: boolean): Finding[] {
  html = decodeReferences(html);
  const findings: Finding[] = [];
  const invite = `https://discord.com/invite/${inviteCode}`;
  const textOnly = html.replace(/<[^>]*>/g, '');
  const termsInText = textOnly.split(TERMS_URL).length - 1;
  let termsTotal = 0;
  for (const url of html.match(DISCORD_URL) ?? []) {
    if (isInvitePage && url === TERMS_URL) {
      termsTotal += 1;
    } else if (!isInvitePage || url !== invite) {
      findings.push(err(file, `Discord URL ${url} is not allowed here${isInvitePage ? ` (only ${invite} and ${TERMS_URL} as text)` : ''}`));
    }
  }
  if (isInvitePage && termsTotal > 1) findings.push(err(file, 'the Terms URL appears more than once on a gate page'));
  if (termsTotal > termsInText) findings.push(err(file, `${TERMS_URL} is accepted only as text content, never inside an attribute`));
  if (isInvitePage) {
    if (/<script\b/i.test(html)) findings.push(err(file, 'gate pages must have no script'));
    if (!html.includes(invite)) findings.push(err(file, `the gate page does not carry ${invite}`));
  }
  return findings;
}

export interface DiscordPageExpectation {
  locale: Locale;
  inviteUrl: string;
  whatsappUrl: string;
  date: string;
  rules: readonly { title: string; body: string }[];
  closing?: string | undefined;
}

const visibleHtml = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');
const plainText = (html: string) => decodeEntities(decodeReferences(html.replace(/<[^>]*>/g, ' '))).replace(/\s+/g, ' ').trim();
const anchors = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  .map((match) => ({ attrs: attributesOf(match[1] ?? ''), text: plainText(match[2] ?? ''), at: match.index }));
const hasClass = (attrs: Map<string, string>, name: string) => (attrs.get('class') ?? '').split(/\s+/).includes(name);

/** Balanced tag ranges for the agreed .gate/.gate-links interface; no dependency or layout element is required. */
function classGroups(html: string, name: string): string[] {
  const stack: { tag: string; start: number; selected: boolean }[] = [];
  const groups: string[] = [];
  for (const match of html.matchAll(/<\/?([a-z][a-z0-9:-]*)\b([^>]*)>/gi)) {
    const tag = match[1]!.toLowerCase();
    if (match[0].startsWith('</')) {
      const top = stack.at(-1);
      if (top?.tag !== tag) continue;
      stack.pop();
      if (top.selected) groups.push(html.slice(top.start, match.index + match[0].length));
    } else if (!/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) && !match[0].endsWith('/>')) {
      stack.push({ tag, start: match.index, selected: hasClass(attributesOf(match[2] ?? ''), name) });
    }
  }
  return groups;
}

function gateSafety(html: string, file: string): Finding[] {
  const findings = inlineExecutable(html, file);
  if ([...html.matchAll(/<main\b/gi)].length !== 1) findings.push(err(file, 'expected exactly one main element'));
  if (/<(?:script|form|noscript)\b/i.test(html)) findings.push(err(file, 'gate and chooser pages have no script, form or noscript'));
  if (/http-equiv\s*=\s*["']?refresh/i.test(html)) findings.push(err(file, 'gate and chooser pages must not refresh'));
  const robots = [...html.matchAll(/<meta\b([^>]*)>/gi)].map((tag) => attributesOf(tag[1] ?? ''));
  if (!robots.some((attrs) => attrs.get('name')?.toLowerCase() === 'robots' && /\bnoindex\b/i.test(attrs.get('content') ?? ''))) {
    findings.push(err(file, 'gate and chooser pages must be noindex'));
  }
  return findings;
}

/** D-78: one localized gate in main; owner rules/date and both link ordering and CSS-group membership are checked. */
export function discordPage(source: string, file: string, expected: DiscordPageExpectation): Finding[] {
  const html = visibleHtml(source);
  const findings = [...gateSafety(html, file), ...htmlLang(html, file, HTML_LANG[expected.locale])];
  const fail = (message: string) => findings.push(err(file, message));
  const main = mainContent(html);
  const groups = classGroups(main, 'gate');
  const group = groups[0] ?? '';
  if (groups.length !== 1) fail('expected exactly one gate group in main');
  const inputs = [...main.matchAll(/<input\b([^>]*)>/gi)];
  const input = inputs[0];
  const attrs = attributesOf(input?.[1] ?? '');
  const id = attrs.get('id');
  if (inputs.length !== 1 || attrs.get('type')?.toLowerCase() !== 'checkbox' || !hasClass(attrs, 'agree')) fail('expected one .agree checkbox');
  if (!id || ![...group.matchAll(/<label\b([^>]*)>/gi)].some((label) => attributesOf(label[1] ?? '').get('for') === id)) fail('no label matches the checkbox');
  if (attrs.get('autocomplete') !== 'off' || attrs.has('name')) fail('checkbox needs autocomplete=off and no name');
  if (attrs.has('disabled') || attrs.has('checked')) fail('checkbox must be neither disabled (links never show) nor pre-checked (links show before confirmation)');
  if (!input || !group.includes(input[0])) fail('checkbox must belong to the gate group');
  const text = plainText(main);
  for (const required of [expected.date, ...expected.rules.flatMap((rule) => [rule.title, rule.body]), ...(expected.closing ? [expected.closing] : [])]) {
    if (!text.includes(plainText(required))) fail('page does not render its localized rules, closing or date');
  }
  const linksGroup = classGroups(group, 'gate-links');
  if (linksGroup.length !== 1) fail('expected one gate-links group following the checkbox');
  const wanted = [expected.inviteUrl, ...(expected.locale === 'pt-br' ? [expected.whatsappUrl] : [])];
  const links = anchors(linksGroup[0] ?? '');
  if (links.map((link) => decodeReferences(link.attrs.get('href') ?? '')).join('\n') !== wanted.join('\n')) fail('gate links must be Discord first and WhatsApp only in pt-BR');
  if (input && group.indexOf(linksGroup[0] ?? '') < group.indexOf(input[0])) fail('join links must follow the checkbox');
  for (const link of links) {
    const rel = (link.attrs.get('rel') ?? '').split(/\s+/);
    if (!rel.includes('noopener') || !rel.includes('noreferrer')) fail('external gate links need rel=noopener noreferrer');
  }
  for (const href of wanted) {
    if (href === '' || decodeReferences(source).split(href).length - 1 !== 1) fail('each real join URL must occur exactly once on its gate page');
  }
  findings.push(...discordLinks(decodeReferences(source), file, expected.inviteUrl.split('/').at(-1) ?? '', true));
  if (expected.locale === 'en-us') findings.push(...whatsappAbsent(html, file));
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '';
  if (WHATSAPP.test(head) || /chat\.whatsapp\.com/i.test(decodeReferences(head))) fail('WhatsApp reference in the gate head');
  return findings;
}

/** The origin fallback chooses a language, without rules or real join links. Its header may link home. */
export function discordChooser(source: string, file: string, rulesText: readonly string[] = []): Finding[] {
  const html = visibleHtml(source);
  const findings = [...gateSafety(html, file), ...htmlLang(html, file, 'en-US'), ...whatsappAbsent(source, file)];
  const fail = (message: string) => findings.push(err(file, message));
  const links = anchors(mainContent(html));
  if (links.length !== 2) fail('chooser main needs exactly two language links');
  for (const [index, locale] of LOCALES.entries()) {
    const link = links[index];
    if (link?.attrs.get('href') !== routePath(locale, 'discord') || link.attrs.get('lang') !== HTML_LANG[locale]
      || link.text !== (locale === 'pt-br' ? 'Português (Brasil)' : 'English')) fail('chooser language link has the wrong destination, lang or label');
  }
  if (/<link\b[^>]*\brel=["'](?:canonical|alternate)["']/i.test(html)) fail('chooser has no canonical or hreflang alternates');
  if (/<input\b/i.test(html) || classGroups(html, 'gate').length > 0) fail('chooser must not contain a gate');
  if ((decodeReferences(source).match(DISCORD_URL) ?? []).length > 0) fail('chooser must not contain a Discord URL');
  const text = plainText(mainContent(html));
  if (rulesText.some((rule) => rule.trim() !== '' && text.includes(plainText(rule)))) fail('chooser must not contain community rules');
  return findings;
}

/** In-site joins use the page locale; alternate-language gate links are limited to the language selector interface. */
export function internalDiscordLinks(html: string, file: string, locale: Locale): Finding[] {
  const findings: Finding[] = [];
  for (const link of anchors(visibleHtml(html))) {
    let url: URL;
    try { url = new URL(decodeReferences(link.attrs.get('href') ?? ''), `https://empirecommunity.org/${file.replace(/^\//, '')}`); } catch { continue; }
    if (url.origin !== 'https://empirecommunity.org') continue;
    if (/^\/discord\/?$/.test(url.pathname)) findings.push(err(file, 'join links use the locale gate, never the public /discord address'));
    for (const target of LOCALES) {
      if (target !== locale && url.pathname === routePath(target, 'discord')
        && !(link.attrs.get('hreflang') === HTML_LANG[target] && link.attrs.get('lang') === HTML_LANG[target])) {
        findings.push(err(file, 'a join link goes to the other locale gate'));
      }
    }
  }
  return findings;
}

const SUPPORTS_HAS = /@supports\s+selector\(:has\(\*\)\)\s*\{/g;

/** Splits the CSS into the bodies of every `@supports selector(:has(*))` block (balanced braces) and everything outside them. */
function splitSupportsHas(css: string): { inside: string; outside: string } {
  let inside = '';
  let outside = '';
  let cursor = 0;
  for (const start of css.matchAll(SUPPORTS_HAS)) {
    if (start.index < cursor) continue;
    let depth = 1;
    let end = start.index + start[0].length;
    while (end < css.length && depth > 0) {
      if (css[end] === '{') depth += 1;
      else if (css[end] === '}') depth -= 1;
      end += 1;
    }
    outside += `${css.slice(cursor, start.index)} `;
    inside += `${css.slice(start.index + start[0].length, depth === 0 ? end - 1 : end)} `;
    cursor = end;
  }
  return { inside, outside: outside + css.slice(cursor) };
}

/**
 * The gate lives in the shared stylesheet: the join links are hidden with `display: none` only inside
 * `@supports selector(:has(*))`, so a browser without `:has()` keeps them visible (the intended fallback). The gate rule
 * must be inside the block, and no rule outside it may hide `.gate-links` without `:has()`.
 */
export function gateCss(css: string, file: string): Finding[] {
  const { inside, outside } = splitSupportsHas(css);
  const findings: Finding[] = [];
  if (!/:not\(:has\(\.agree:checked\)\)\s*\.gate-links\s*\{[^{}]*display:\s*none/.test(inside)) {
    findings.push(err(file, 'the gate rule (.gate-links hidden until .agree is checked) is missing from the @supports selector(:has(*)) block'));
  }
  const hiddenOutside = [...outside.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(
    ([, selectors = '', body = '']) =>
      /display:\s*none/.test(body) && selectors.split(',').some((selector) => selector.trim().endsWith('.gate-links') && !selector.includes(':has(')),
  );
  if (hiddenOutside) findings.push(err(file, 'the join links are hidden outside @supports selector(:has(*)): a browser without :has() could not use them'));
  return findings;
}

/**
 * Legal Markdown has no raw HTML (site-data section 11): the renderer drops it, and the source must not carry any, so the
 * text a reviewer reads is the text that is published. An autolink (`<https://...>`) is Markdown, not HTML.
 */
export function legalMarkdownHtml(markdown: string, file: string): Finding[] {
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  return /<(?!https?:\/\/)[A-Za-z/!?]/.test(body) ? [err(file, 'raw HTML in a legal Markdown text')] : [];
}

/** True when the front matter of a legal Markdown file sets `effectiveDate` (the launch PR sets it in all four files, D-51). */
export function hasEffectiveDate(markdown: string): boolean {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] ?? '';
  return /^effectiveDate:\s*\S/m.test(front);
}

const PAYMENT_MARKERS: [RegExp, string][] = [
  [/data-pix/i, 'attribute data-pix'],
  [/mercadopago|mpago\.la/i, 'payment-provider host or short link'],
  [/br\.gov\.bcb\.pix/i, 'Pix BR Code marker'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, 'UUID-shaped string (random Pix key)'],
  [/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/, 'CNPJ-shaped string'],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, 'CPF-shaped string (the tax id is never written in the repository, D-23)'],
];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Payment guard (site-data section 10, D-28): the site receives no money and shows no way to send any. */
export function paymentGuard(text: string, file: string, allowedEmails: ReadonlySet<string>): Finding[] {
  const findings: Finding[] = [];
  for (const [pattern, label] of PAYMENT_MARKERS) {
    if (pattern.test(text)) findings.push(err(file, `payment marker: ${label}`));
  }
  for (const email of text.match(EMAIL) ?? []) {
    if (!allowedEmails.has(email.toLowerCase())) findings.push(err(file, `e-mail outside the site.yaml contact allowlist: ${email}`));
  }
  return findings;
}

export const decodeEntities = (text: string) =>
  text.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code))).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/**
 * Cloudflare Web Analytics (routing-locale section 5, D-52). A locale page other than Apoiar carries exactly one beacon:
 * an external module script from the Cloudflare host whose `data-cf-beacon` holds the configured token and nothing else.
 * The support pages, both gates, the root chooser, the 404 and /discord carry none (the neutral pages have no script at all).
 */
export function analyticsBeacon(html: string, file: string, expected: boolean, token: string): Finding[] {
  const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].map((match) => attributesOf(match[1] ?? ''));
  const beacons = scripts.filter((attrs) => (attrs.get('src') ?? '').includes('cloudflareinsights') || attrs.has('data-cf-beacon'));
  const mentioned = /cloudflareinsights|data-cf-beacon/i.test(html);
  if (!expected) return mentioned ? [err(file, 'this page carries no analytics beacon (routing-locale section 5, site-data section 10)')] : [];
  if (beacons.length !== 1) return [err(file, `expected exactly one analytics beacon, found ${beacons.length}`)];
  const attrs = beacons[0];
  const findings: Finding[] = [];
  if (attrs?.get('src') !== BEACON_SRC) findings.push(err(file, `the beacon src must be exactly ${BEACON_SRC}`));
  if (attrs?.get('type')?.toLowerCase() !== 'module') findings.push(err(file, 'the beacon is an external module script'));
  let config: unknown;
  try {
    config = JSON.parse(decodeEntities(attrs?.get('data-cf-beacon') ?? ''));
  } catch {
    config = undefined;
  }
  const keys = typeof config === 'object' && config !== null ? Object.keys(config) : [];
  if (keys.join() !== 'token' || (config as { token?: unknown }).token !== token) {
    findings.push(err(file, 'data-cf-beacon must hold only the site token from site.yaml'));
  }
  return findings;
}

/** "Pix" and "Mercado Pago" in page text are a warning for the PR reviewer, not a failure. */
export function paymentWords(html: string, file: string): Finding[] {
  const text = html.replace(/<[^>]*>/g, ' ');
  return /\bpix\b|mercado\s?pago/i.test(text) ? [warn(file, 'the words "Pix" or "Mercado Pago" appear in page text; confirm they do not suggest donations are open')] : [];
}

type Alternate = { lang: string; href: string };

export function pageLinks(html: string): { canonical: string | undefined; alternates: Alternate[] } {
  const canonical = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i.exec(html)?.[0];
  const hrefOf = (tag: string | undefined) => (tag === undefined ? undefined : /\bhref=["']([^"']+)["']/i.exec(tag)?.[1]);
  const alternates: Alternate[] = [];
  for (const tag of html.matchAll(/<link\b[^>]*\brel=["']alternate["'][^>]*>/gi)) {
    const lang = /\bhreflang=["']([^"']+)["']/i.exec(tag[0])?.[1];
    const href = hrefOf(tag[0]);
    if (lang !== undefined && href !== undefined) alternates.push({ lang, href });
  }
  return { canonical: hrefOf(canonical), alternates };
}

const LOCALE_LABELS: ReadonlyMap<string, string> = new Map([['pt-BR', 'pt-br'], ['en-US', 'en-us']]);

/** C-5: every locale page has a canonical and reciprocal hreflang alternates (including itself and x-default). */
export function hreflangReciprocity(pages: ReadonlyMap<string, string>, origin: string, extraKnown: ReadonlySet<string> = new Set()): Finding[] {
  const findings: Finding[] = [];
  const links = new Map([...pages].map(([url, html]) => [url, pageLinks(html)] as const));
  for (const [url, { canonical, alternates }] of links) {
    if (canonical !== `${origin}${url}`) findings.push(err(url, `canonical is ${canonical ?? 'missing'}, expected ${origin}${url}`));
    const langs = new Set(alternates.map((a) => a.lang));
    for (const need of ['pt-BR', 'en-US', 'x-default']) {
      if (!langs.has(need)) findings.push(err(url, `hreflang ${need} missing`));
    }
    for (const alt of alternates) {
      const target = alt.href.startsWith(origin) ? alt.href.slice(origin.length) : undefined;
      if (target === undefined) {
        findings.push(err(url, `hreflang ${alt.lang} points outside the site: ${alt.href}`));
        continue;
      }
      const route = url.replace(/^\/(?:pt-br|en-us)\//, '');
      // x-default: the root chooser on the two home pages, the matching en-US page on inner pages (routing-locale section 4).
      const wantedPath = alt.lang === 'x-default' ? (route === '' ? '/' : `/en-us/${route}`) : LOCALE_LABELS.has(alt.lang) ? `/${LOCALE_LABELS.get(alt.lang)}/${route}` : undefined;
      if (wantedPath !== undefined && target !== wantedPath) {
        findings.push(err(url, `hreflang ${alt.lang} points to ${target}, expected ${wantedPath}`));
        continue;
      }
      const back = links.get(target);
      if (back === undefined && alt.lang === 'x-default' && extraKnown.has(target)) continue;
      if (back === undefined) {
        findings.push(err(url, `hreflang ${alt.lang} points to ${target}, which is not built`));
      } else if (alt.lang !== 'x-default' && !back.alternates.some((b) => b.href === `${origin}${url}`)) {
        findings.push(err(url, `hreflang ${alt.lang} -> ${target} is not reciprocal`));
      }
    }
  }
  return findings;
}

/** `<html lang>` (WCAG 3.1.1): a locale page carries its locale; the chooser, the 404 and /discord are en-US (routing-locale sections 1 and 3). */
export function htmlLang(html: string, file: string, expected: 'pt-BR' | 'en-US'): Finding[] {
  const tag = /<html\b([^>]*)>/i.exec(html)?.[1] ?? '';
  const lang = attributesOf(tag).get('lang');
  return lang === expected ? [] : [err(file, `<html lang> is ${lang ?? 'missing'}, expected ${expected}`)];
}

/**
 * Header logo (information-architecture section 4): the wordmark in the first `<header>` sits inside a link to the home
 * page: `/pt-br/` or `/en-us/` on a locale page, the root `/` on the chooser, the 404 and /discord.
 */
export function headerLogoLink(html: string, file: string, expectedHref: string): Finding[] {
  const visible = html.replace(/<!--[\s\S]*?-->/g, ''); // a commented-out anchor is not a link
  const header = /<header\b[^>]*>([\s\S]*?)<\/header>/i.exec(visible)?.[1] ?? '';
  const logoLinks = [...header.matchAll(/<a\b([^>]*)>(?:(?!<\/a>)[\s\S])*?<svg\b/gi)].map((match) => attributesOf(match[1] ?? ''));
  if (logoLinks.length === 0) return [err(file, 'the header logo is not a link')];
  const href = logoLinks[0]?.get('href');
  return href === expectedHref ? [] : [err(file, `the header logo goes to ${href ?? 'nothing'}, expected ${expectedHref}`)];
}

/**
 * Language selector (routing-locale section 2). A selector is a `<nav>` that holds links with `hreflang` (the header renders
 * one per breakpoint, so each is checked on its own). Each has exactly one link per locale, with a supported `hreflang`
 * value, the same value in `lang`, an `href` to the equivalent page, and `aria-current="true"` on the current locale's
 * link only (the other link has no `aria-current` at all). The page must have at least one selector.
 */
export function languageSelector(html: string, file: string, locale: 'pt-br' | 'en-us', route: string): Finding[] {
  const findings: Finding[] = [];
  let selectors = 0;
  for (const nav of html.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi)) {
    const links = [...(nav[1] ?? '').matchAll(/<a\b([^>]*)>/gi)]
      .map((match) => attributesOf(match[1] ?? ''))
      .filter((attrs) => attrs.has('hreflang'));
    if (links.length === 0) continue;
    selectors += 1;
    const seen = new Map<string, number>();
    for (const attrs of links) {
      const target = attrs.get('hreflang') ?? '';
      const targetLocale = LOCALE_LABELS.get(target);
      if (targetLocale === undefined) {
        findings.push(err(file, `selector link has an unsupported hreflang value "${target}"`));
        continue;
      }
      seen.set(targetLocale, (seen.get(targetLocale) ?? 0) + 1);
      const wanted = `/${targetLocale}/${route}`;
      if (attrs.get('href') !== wanted) findings.push(err(file, `selector link ${target} goes to ${attrs.get('href') ?? 'nothing'}, expected ${wanted}`));
      if (attrs.get('lang') !== target) findings.push(err(file, `selector link ${target} has no matching lang attribute`));
      const current = attrs.get('aria-current');
      if (targetLocale === locale ? current !== 'true' : current !== undefined) {
        findings.push(err(file, `selector link ${target} has the wrong aria-current (${current ?? 'none'})`));
      }
    }
    for (const needed of LOCALE_LABELS.values()) {
      const count = seen.get(needed) ?? 0;
      if (count !== 1) findings.push(err(file, `a selector has ${count} links to ${needed}, expected 1`));
    }
  }
  if (selectors === 0) findings.push(err(file, 'the page has no language selector'));
  return findings;
}

// RFC 3339 date-time (JSON Schema format date-time): a bare date such as 2026-11-09 is not one.
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;

/** Origin fallback of the member count (members-json sections 2 and 4): the schema, built-in source, bounds. */
export function membersFallback(text: string, file: string): Finding[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [err(file, 'is not valid JSON')];
  }
  if (typeof data !== 'object' || data === null) return [err(file, 'must be a JSON object')];
  const root = data as { schema?: unknown; discord?: { members?: unknown; updatedAt?: unknown; source?: unknown } | null };
  const discord = root.discord;
  const members = discord?.members;
  const valid =
    root.schema === 1 &&
    typeof members === 'number' && Number.isInteger(members) && members >= 1 && members <= 1_000_000 &&
    typeof discord?.updatedAt === 'string' && DATE_TIME.test(discord.updatedAt) && !Number.isNaN(Date.parse(discord.updatedAt)) &&
    discord.source === 'built-in';
  return valid ? [] : [err(file, 'does not match members.json v1 (schema 1, integer members 1..1000000, RFC 3339 date-time updatedAt, source built-in)')];
}

export const WHATSAPP_COUNT_MAX_AGE_DAYS = 180;
export const SUPPORT_VERIFIED_MAX_AGE_DAYS = 90;

export interface ReviewDates {
  /** `whatsapp.asOf` of community.yaml. */
  whatsappAsOf: string | undefined;
  /** `verified.on` of support.yaml. */
  supportVerifiedOn: string | undefined;
  /** `consent.reviewOn` of each team entry (opaque ids only). */
  reviewOns: readonly { id: string; on: string }[];
}

const MS_PER_DAY = 86_400_000;
const daysBetween = (isoDate: string, today: Date) => Math.floor((today.getTime() - Date.parse(`${isoDate}T00:00:00Z`)) / MS_PER_DAY);

/** Stale dates (site-data section 12): warnings only, so an old date asks for a review without blocking a release. `today` is injected. */
export function staleDates(dates: ReviewDates, today: Date): Finding[] {
  const findings: Finding[] = [];
  if (dates.whatsappAsOf !== undefined) {
    const age = daysBetween(dates.whatsappAsOf, today);
    if (age > WHATSAPP_COUNT_MAX_AGE_DAYS) findings.push(warn('src/data/community.yaml', `whatsapp.asOf is ${age} days old (over ${WHATSAPP_COUNT_MAX_AGE_DAYS}): refresh the member count`));
  }
  if (dates.supportVerifiedOn !== undefined) {
    const age = daysBetween(dates.supportVerifiedOn, today);
    if (age > SUPPORT_VERIFIED_MAX_AGE_DAYS) findings.push(warn('src/data/support.yaml', `verified.on is ${age} days old (over ${SUPPORT_VERIFIED_MAX_AGE_DAYS}): the owner re-verifies the support data`));
  }
  for (const { id, on } of dates.reviewOns) {
    if (daysBetween(on, today) > 0) findings.push(warn('src/data/team.yaml', `entry ${id}: consent.reviewOn (${on}) is in the past: the yearly consent review is due`));
  }
  return findings;
}
