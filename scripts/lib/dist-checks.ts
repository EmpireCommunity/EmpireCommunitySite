// Pure checks over the built site (docs/contracts/site-data.md section 12, routing-locale sections 4 and 6).
// Each function takes text and returns findings; scripts/check-dist.ts reads the files and prints them.

export type Finding = { level: 'error' | 'warning'; file: string; message: string };

const err = (file: string, message: string): Finding => ({ level: 'error', file, message });
const warn = (file: string, message: string): Finding => ({ level: 'warning', file, message });

/** Inline executable script, `<style>`, `style=` and event-handler attributes break the strict CSP (no unsafe-inline). */
export function inlineExecutable(html: string, file: string): Finding[] {
  const findings: Finding[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = match[1] ?? '';
    const isData = /\btype\s*=\s*["']?application\/ld\+json/i.test(attrs);
    if (!/\bsrc\s*=/i.test(attrs) && !isData) findings.push(err(file, 'inline executable <script>'));
  }
  if (/<style\b/i.test(html)) findings.push(err(file, 'inline <style> element'));
  for (const tag of html.matchAll(/<[a-z][^>]*>/gi)) {
    if (/\sstyle\s*=/i.test(tag[0])) findings.push(err(file, `style attribute in ${tag[0].slice(0, 60)}`));
    if (/\son[a-z]+\s*=/i.test(tag[0])) findings.push(err(file, `inline event handler in ${tag[0].slice(0, 60)}`));
  }
  return findings;
}

const WHATSAPP = /whats\s?app|\bwa\.me\b|api\.whatsapp\.com/i;

/** C-1: WhatsApp never appears in en-US output, llms.txt, the root page or the legal pages. */
export function whatsappAbsent(text: string, file: string): Finding[] {
  return WHATSAPP.test(text) ? [err(file, 'WhatsApp reference where the contract forbids it (C-1)')] : [];
}

const DISCORD_URL = /https?:\/\/(?:[a-z0-9-]+\.)*discord(?:app)?\.(?:com|gg)(?:\/[^\s"'<>)]*)?/gi;

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

/** Origin fallback of the member count (members-json sections 2 and 4): the schema, built-in source, bounds. */
export function membersFallback(text: string, file: string): Finding[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [err(file, 'is not valid JSON')];
  }
  const root = data as { schema?: unknown; discord?: { members?: unknown; updatedAt?: unknown; source?: unknown } };
  const discord = root.discord;
  const members = discord?.members;
  const valid =
    root.schema === 1 &&
    typeof members === 'number' && Number.isInteger(members) && members >= 1 && members <= 1_000_000 &&
    typeof discord?.updatedAt === 'string' && !Number.isNaN(Date.parse(discord.updatedAt)) &&
    discord.source === 'built-in';
  return valid ? [] : [err(file, 'does not match members.json v1 (schema 1, integer members 1..1000000, date-time updatedAt, source built-in)')];
}
