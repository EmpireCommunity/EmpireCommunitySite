// Pure decisions for deploy section 8. Inputs are public, untrusted responses; time is supplied by the caller.
import ts from 'typescript';
import { membersFromPayload } from '../../src/lib/members.ts';
import { discordLinks, paymentGuard } from './dist-checks.ts';

export const SITE_ORIGIN = 'https://empirecommunity.org';
export const WORKER_CONFIG_URL = 'https://raw.githubusercontent.com/EmpireCommunity/EmpireCommunitySite-Worker/main/wrangler.jsonc';
export const SITEMAP_LIMIT = 100;
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
    if (url.search && !((url.pathname === '/' || url.pathname === '/discord') && url.search === '?utm_source=ci')) throw new Error('Disallowed public query');
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

/** Derive the deployed invite, rather than comparing released HTML with main. No checkbox or WhatsApp checks. */
export function discordEntry(response: PublicResponse): { code?: string; problems: string[] } {
  const problems: string[] = [];
  const html = decoded(response.text);
  if (response.status !== 200 || response.headers.has('location')) problems.push('Discord entry must be 200 without Location');
  const containers = [...html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi)]
    .filter((match) => /(?:^|\s)lang\s*=/.test(match[1]!));
  const codes: string[] = [];
  for (const lang of ['pt-BR', 'en-US']) {
    const matches = containers.filter((match) => new RegExp(`(?:^|\\s)lang\\s*=\\s*["']${lang}["']`, 'i').test(match[1]!));
    const links = [...(matches[0]?.[2] ?? '').matchAll(/<a\b[^>]*>/gi)].flatMap((anchor) => {
      const href = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+))/i.exec(anchor[0]);
      const invite = /^https:\/\/discord\.com\/invite\/([A-Za-z0-9-]{2,32})$/.exec(href?.[1] ?? href?.[2] ?? href?.[3] ?? '');
      return invite?.[1] === undefined ? [] : [invite[1]];
    });
    if (matches.length !== 1 || links.length !== 1) problems.push('Each language container needs exactly one invite');
    if (links[0]) codes.push(links[0]);
  }
  const code = codes[0];
  if (code === undefined || codes.length !== 2 || codes.some((value) => value !== code)) problems.push('Language invites must agree');
  if (code !== undefined && html.split(`https://discord.com/invite/${code}`).length - 1 !== 2) problems.push('Discord entry must have only the two language invites');
  if (code !== undefined && discordLinks(html, '/discord', code, true).length > 0) problems.push('Discord entry contains disallowed URLs or scripts');
  if (/http-equiv\s*=\s*["']?refresh/i.test(html)) problems.push('Discord entry must not refresh');
  return { ...(code !== undefined ? { code } : {}), problems };
}

export function inviteLinks(html: string, code: string, entry: boolean): string[] {
  return discordLinks(decoded(html), 'live page', code, entry).length === 0 ? [] : ['Disallowed Discord invite URL'];
}

export function noPayment(html: string, support: boolean): string[] {
  // Contract addresses, not release-dependent page copy from main.
  const allowed = new Set(['contact@empirecommunity.org', 'legal@empirecommunity.org']);
  const problems = paymentGuard(decoded(html), 'live page', allowed).length > 0 ? ['Payment guard failed'] : [];
  if (support) {
    const blocks = [...html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bdata-donations=["']not-open["'][^>]*>([\s\S]*?)<\/\1>/gi)];
    if (blocks.length !== 1 || /</.test(blocks[0]?.[2] ?? '') || !blocks[0]?.[2]?.trim()) problems.push('Support needs one plain-text not-open block');
  }
  if (!support && /data-donations\s*=/i.test(html)) problems.push('Donations block belongs only to support');
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
  return now - Date.parse(timestamp) > 3 * 24 * 60 * 60 * 1000 ? ['Member count is older than three days'] : [];
}

export function publicHeaders(response: PublicResponse, support: boolean): string[] {
  const problems: string[] = [];
  const script = support ? "script-src 'self'; connect-src 'self'" : "script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com";
  const expected: Record<string, string> = {
    'content-security-policy': `default-src 'self'; ${script}; img-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
    'cross-origin-opener-policy': 'same-origin',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  for (const [name, value] of Object.entries(expected)) if (response.headers.get(name) !== value) problems.push(`Unexpected ${name}`);
  if (!response.headers.get('strict-transport-security')) problems.push('HSTS missing');
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
