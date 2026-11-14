import { HTML_LANG, LOCALES, routePath, type Locale } from '../../src/lib/routes.ts';
// Pure decisions for deploy section 8. Inputs are public, untrusted responses; time is supplied by the caller.
import ts from 'typescript';
import { DEFAULT_CSP, SUPPORT_CSP, PERMISSIONS_POLICY } from './security-headers.ts';
import { membersFromPayload } from '../../src/lib/members.ts';
import { discordLinks, htmlLang, internalDiscordLinks, paymentGuard } from './dist-checks.ts';
import { charsetFirst, donationsBlock, donationsBlockElsewhere, noReferrerMeta, notOpenText } from './donations-checks.ts';

export const SITE_ORIGIN = 'https://empirecommunity.org';
export const WORKER_CONFIG_URL = 'https://raw.githubusercontent.com/EmpireCommunity/EmpireCommunitySite-Worker/main/wrangler.jsonc';
export const SITEMAP_LIMIT = 100;
const MEMBER_CLOCK_SKEW_MS = 5 * 60 * 1000;
export interface PublicResponse { status: number; headers: Headers; text: string }
export type Level = 'error' | 'warning';
export const findingLevel = (pending: boolean): Level => pending ? 'warning' : 'error';

/** Only same-origin public pages and sitemap documents may be discovered; /data/ is probed separately, once. */
export function siteUrl(input: string): URL {
  const url = new URL(input, SITE_ORIGIN);
  if (url.origin !== SITE_ORIGIN || url.username || url.password || url.search || url.hash
    || decodeURIComponent(url.pathname).startsWith('/data/')) throw new Error('Disallowed discovered URL');
  return url;
}

/** This is the complete HTTP allowlist; HTML and response headers cannot supply an external destination. */
export function publicDestination(input: string): URL {
  const url = new URL(input);
  if (url.username || url.password || url.hash) throw new Error('Disallowed public destination');
  if (url.origin === SITE_ORIGIN) {
    const path = decodeURIComponent(url.pathname);
    if (path.startsWith('/data/') && (url.pathname !== '/data/members.json' || url.search !== '')) throw new Error('Disallowed data probe');
    if (url.search && !((url.pathname === '/' || /^\/discord\/?$/.test(url.pathname) || LOCALES.some((locale) => url.pathname === routePath(locale, 'discord'))) && url.search === '?utm_source=ci')) throw new Error('Disallowed public query');
  } else if (url.href !== WORKER_CONFIG_URL && !(url.origin === 'https://discord.com'
    && /^\/api\/v10\/invites\/[A-Za-z0-9-]{2,32}$/.test(url.pathname) && url.search === '?with_counts=true')) {
    throw new Error('Disallowed public destination');
  }
  return url;
}

export function sitemapUrls(xml: string): string[] {
  if (!/<(?:sitemapindex|urlset)\b/.test(xml)) throw new Error('Missing sitemap document');
  const urls = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((match) => siteUrl(match[1]!.trim()).href);
  if (urls.length === 0 || urls.length > SITEMAP_LIMIT) throw new Error('Invalid sitemap size');
  return [...new Set(urls)];
}

function decoded(html: string): string {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", colon: ':', sol: '/', period: '.' };
  return html.replace(/&#(x[\da-f]+|\d+);?|&(amp|quot|apos|colon|sol|period);/gi, (whole, numeric: string | undefined, name: string | undefined) => {
    if (numeric !== undefined) {
      const value = numeric.toLowerCase().startsWith('x') ? parseInt(numeric.slice(1), 16) : Number(numeric);
      return value <= 0x10ffff ? String.fromCodePoint(value) : whole;
    }
    return named[name?.toLowerCase() ?? ''] ?? whole;
  });
}

/** Derive the released invite independently on each locale gate; never compare released copy with main. */
export function discordEntry(response: PublicResponse, locale: Locale): { code?: string; problems: string[] } {
  const problems: string[] = [];
  const html = decoded(response.text);
  if (response.status !== 200 || response.headers.has('location')) problems.push('Discord gate must be 200 without Location');
  if (htmlLang(html, 'live gate', HTML_LANG[locale]).length > 0) problems.push('Gate language does not match its URL');
  const codes = [...html.matchAll(/<a\b[^>]*>/gi)].flatMap((anchor) => {
    const href = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+))/i.exec(anchor[0]);
    const invite = /^https:\/\/discord\.com\/invite\/([A-Za-z0-9-]{2,32})$/.exec(href?.[1] ?? href?.[2] ?? href?.[3] ?? '');
    return invite?.[1] ? [invite[1]] : [];
  });
  const code = codes[0];
  if (code === undefined || codes.length !== 1) problems.push('Each gate needs exactly one Discord invite');
  if (code !== undefined && (html.split(`https://discord.com/invite/${code}`).length - 1 !== 1
    || discordLinks(html, 'live gate', code, true).length > 0)) problems.push('Gate contains extra or disallowed Discord URLs or scripts');
  if (/http-equiv\s*=\s*["']?refresh/i.test(html)) problems.push('Discord gate must not refresh');
  return { ...(code !== undefined ? { code } : {}), problems };
}

export function inviteLinks(html: string, code: string, entry: boolean, path = ''): string[] {
  const locale = LOCALES.find((candidate) => path.startsWith(routePath(candidate, 'home')));
  return discordLinks(decoded(html), 'live page', code, entry).length > 0
    || (locale !== undefined && internalDiscordLinks(decoded(html), path, locale).length > 0) ? ['Disallowed Discord join URL'] : [];
}

/** D-78, non-Brazilian runner: the public chooser address redirects at the edge, keeping the query. */
export function discordRedirect(response: PublicResponse): string[] {
  try {
    return response.status === 302 && new URL(response.headers.get('location') ?? '', SITE_ORIGIN).href === `${SITE_ORIGIN}${routePath('en-us', 'discord')}?utm_source=ci`
      ? [] : ['Discord address must redirect temporarily to the en-US gate and preserve the query'];
  } catch { return ['Invalid Discord redirect location']; }
}

export function noPayment(html: string, support: boolean, locale?: string): string[] {
  // Contract addresses, not release-dependent page copy from main.
  const allowed = new Set(['contact@empirecommunity.org', 'legal@empirecommunity.org']);
  const problems = paymentGuard(decoded(html), 'live page', allowed).length > 0 ? ['Payment guard failed'] : [];
  if (support) {
    // The live page carries one donations block, `not-open` (plain text) or `open` (the one form that posts to the donations
    // service, donations contract section 2); which of the two is the release's business, not the monitor's. The no-referrer
    // meta is part of the delivered page (the return from a payment carries identifiers in its address).
    const found = donationsBlock(html, 'live page', locale);
    problems.push(...found.findings.map((finding) => finding.message));
    if (found.state === 'not-open' && notOpenText(html) === '') problems.push('Support needs one plain-text not-open block');
    problems.push(...noReferrerMeta(html, 'live page').map((finding) => finding.message), ...charsetFirst(html, 'live page').map((finding) => finding.message));
  }
  if (!support) problems.push(...donationsBlockElsewhere(html, 'live page').map((finding) => finding.message));
  return problems;
}

export function rewriting(html: string): string[] {
  return /data-cfemail|__cf_email__|\/cdn-cgi\/(?:scripts\/|l\/email-protection)|rocket-loader|text\/rocketscript|data-cfasync|cloudflareinsights|data-cf-beacon/i.test(decoded(html))
    ? ['Support HTML rewriting or analytics marker detected'] : [];
}

export function rootRedirect(response: PublicResponse): string[] {
  const location = response.headers.get('location');
  try { return response.status === 302 && location !== null
    && new URL(location, SITE_ORIGIN).href === `${SITE_ORIGIN}/en-us/?utm_source=ci`
    ? [] : ['Root must redirect temporarily to en-US and preserve the query'];
  } catch { return ['Invalid root redirect location']; }
}

export function liveMembers(text: string, now: number): string[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return ['Invalid members JSON']; }
  if (membersFromPayload(data) === undefined) return ['Invalid members schema or count'];
  const discord = (data as { discord: { updatedAt?: unknown; source?: unknown } }).discord;
  const timestamp = discord.updatedAt;
  if (discord.source !== 'discord-invite' && discord.source !== 'empirebot') return ['Members source must be live'];
  if (typeof timestamp !== 'string' || !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.test(timestamp)
    || !Number.isFinite(Date.parse(timestamp))) return ['Invalid members timestamp'];
  const [year = 0, month = 0, day = 0] = timestamp.slice(0, 10).split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]!) return ['Invalid members timestamp'];
  const updatedAt = Date.parse(timestamp);
  if (updatedAt > now + MEMBER_CLOCK_SKEW_MS) return ['Members timestamp is in the future'];
  return now - updatedAt > 3 * 24 * 60 * 60 * 1000 ? ['Member count is older than three days'] : [];
}

export function publicHeaders(response: PublicResponse, support: boolean): string[] {
  const problems: string[] = [];
  const expected: Record<string, string> = {
    'content-security-policy': support ? SUPPORT_CSP : DEFAULT_CSP,
    'permissions-policy': PERMISSIONS_POLICY,
    'cross-origin-opener-policy': 'same-origin',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  for (const [name, value] of Object.entries(expected)) if (response.headers.get(name) !== value) problems.push(`Unexpected ${name}`);
  // The deploy contract requires HSTS without prescribing a duration; zero disables it (RFC 6797 section 6.1.1).
  const maxAgeDirectives = (response.headers.get('strict-transport-security') ?? '').split(';')
    .map((directive) => directive.trim()).filter((directive) => /^max-age(?:\s*=|$)/i.test(directive));
  const maxAge = maxAgeDirectives.length === 1 ? /^max-age\s*=\s*(?:"(\d+)"|(\d+))$/i.exec(maxAgeDirectives[0]!) : null;
  if (maxAge === null || !(Number(maxAge[1] ?? maxAge[2]) > 0)) problems.push('HSTS requires a positive max-age');
  if (response.headers.has('set-cookie') || /\d/.test(response.headers.get('server') ?? '')) problems.push('Cookie or versioned Server header');
  return problems;
}

export function workerCopies(text: string, invite: string, guild: string): string[] {
  const { config, error } = ts.parseConfigFileTextToJson('wrangler.jsonc', text) as { config?: { vars?: Record<string, unknown> }; error?: unknown };
  return !error && config?.vars?.DISCORD_INVITE_CODE === invite && config.vars.DISCORD_GUILD_ID === guild
    ? [] : ['Worker and site invite configuration differs or is invalid'];
}

export function inviteGuild(text: string, code: string, guild: string): string[] {
  let data: { code?: unknown; guild?: { id?: unknown } } | null;
  try { data = JSON.parse(text) as typeof data; } catch { return ['Invalid invite response']; }
  return data?.code === code && data.guild?.id === guild ? [] : ['Discord invite does not identify the configured guild'];
}

/** An oversized Retry-After means no retry, never an early request. Only transient errors are retried once. */
export function discordRetryDelay(status: number, retryAfter: string | null, now: number): number | undefined {
  if (status !== 0 && status !== 429 && (status < 500 || status > 599)) return undefined;
  if (retryAfter === null) return status === 429 ? undefined : 1000;
  const delay = /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - now;
  return Number.isFinite(delay) && delay >= 0 && delay <= 60_000 ? delay : undefined;
}

// A final rate-limited response is inconclusive, rather than evidence of a broken invite.
export function inviteLookup(response: PublicResponse, code: string, guild: string): { problems: string[]; level: Level } {
  if (response.status === 429) return { problems: ['Discord invite lookup rate limited'], level: 'warning' };
  return {
    problems: [
      ...(response.status === 200 && !response.headers.has('location') ? [] : ['Expected 200 without Location']),
      ...inviteGuild(response.text, code, guild),
    ],
    level: 'error',
  };
}
