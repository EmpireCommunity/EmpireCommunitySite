// Pure checks over the built site (docs/contracts/site-data.md section 12, routing-locale sections 4 and 6).
// Each function takes text and returns findings; scripts/check-dist.ts reads the files and prints them.

export type Finding = { level: 'error' | 'warning'; file: string; message: string };

const err = (file: string, message: string): Finding => ({ level: 'error', file, message });
const warn = (file: string, message: string): Finding => ({ level: 'warning', file, message });

/** Attribute names (lower-cased, exact) and values of one tag's attribute text: `data-src` is not `src`; the first duplicate wins. */
function attributesOf(text: string): Map<string, string> {
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

/** The WhatsApp community link is read only by the /discord page (site-data section 8, D-41): nowhere else in `dist/`. */
export function whatsappInviteLink(text: string, file: string, isInvitePage: boolean): Finding[] {
  return !isInvitePage && /chat\.whatsapp\.com/i.test(text) ? [err(file, 'the WhatsApp community link may appear only on the /discord page (D-41)')] : [];
}

const DISCORD_URL = /(?:https?:)?\/\/(?:[a-z0-9-]+\.)*discord(?:app)?\.(?:com|gg)(?:\/[^\s"'<>)]*)?/gi;

/**
 * The only Discord link on the site is https://empirecommunity.org/discord (not matched here: another host). A URL on a
 * Discord host appears only in the /discord page, and only as the invite with the configured code. That page has no
 * script (D-29).
 */
export function discordLinks(html: string, file: string, inviteCode: string, isInvitePage: boolean): Finding[] {
  const findings: Finding[] = [];
  const invite = `https://discord.com/invite/${inviteCode}`;
  for (const url of html.match(DISCORD_URL) ?? []) {
    if (!isInvitePage || url !== invite) {
      findings.push(err(file, `Discord URL ${url} is not allowed here${isInvitePage ? ` (only ${invite})` : ''}`));
    }
  }
  if (isInvitePage) {
    if (/<script\b/i.test(html)) findings.push(err(file, 'the /discord page must have no script'));
    if (!html.includes(invite)) findings.push(err(file, `the /discord page does not carry ${invite}`));
  }
  return findings;
}

const PAYMENT_MARKERS: [RegExp, string][] = [
  [/data-pix/i, 'attribute data-pix'],
  [/mercadopago|mpago\.la/i, 'payment-provider host or short link'],
  [/br\.gov\.bcb\.pix/i, 'Pix BR Code marker'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, 'UUID-shaped string (random Pix key)'],
  [/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/, 'CNPJ-shaped string'],
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
