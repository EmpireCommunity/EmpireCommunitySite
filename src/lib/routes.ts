// Single source of URLs (docs/contracts/routing-locale.md section 1). Nothing else hardcodes a path.

export const LOCALES = ['pt-br', 'en-us'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pt-br';

/** `lang` attribute and hreflang values. */
export const HTML_LANG: Readonly<Record<Locale, string>> = { 'pt-br': 'pt-BR', 'en-us': 'en-US' };
/** Open Graph locale values. */
export const OG_LOCALE: Readonly<Record<Locale, string>> = { 'pt-br': 'pt_BR', 'en-us': 'en_US' };

export const ROUTE_KEYS = [
  'home',
  'projects',
  'game-servers',
  'join',
  'support',
  'organization',
  'terms',
  'privacy',
] as const;
export type RouteKey = (typeof ROUTE_KEYS)[number];

/** Slugs are English and identical in both locales; the home slug is empty. */
const SLUGS: Readonly<Record<RouteKey, string>> = {
  home: '',
  projects: 'projects',
  'game-servers': 'game-servers',
  join: 'join',
  support: 'support',
  organization: 'organization',
  terms: 'terms-of-service',
  privacy: 'privacy-policy',
};

export type InnerRouteKey = Exclude<RouteKey, 'home'>;
export const INNER_ROUTE_KEYS = ROUTE_KEYS.filter((key): key is InnerRouteKey => key !== 'home');

/** The member-count JSON: the origin fallback built by the site, and what the browser asks first (members-json section 3). */
export const MEMBERS_JSON_PATH = '/data/members.json';

export function slugOf(key: RouteKey): string {
  return SLUGS[key];
}

export function routeKeyFromSlug(slug: string): InnerRouteKey | undefined {
  return INNER_ROUTE_KEYS.find((key) => SLUGS[key] === slug);
}

/** Path with leading and trailing slash, for example `/pt-br/projects/`. */
export function routePath(locale: Locale, key: RouteKey): string {
  const slug = SLUGS[key];
  return slug === '' ? `/${locale}/` : `/${locale}/${slug}/`;
}

/** Reciprocal alternates for a route, one per locale (itself included). */
export function alternates(key: RouteKey): { locale: Locale; hreflang: string; path: string }[] {
  return LOCALES.map((locale) => ({ locale, hreflang: HTML_LANG[locale], path: routePath(locale, key) }));
}

/**
 * `x-default`: the root on the two home pages, the en-US page on inner pages
 * (everyone who is not Brazilian is served English, D-15).
 */
export function xDefaultPath(key: RouteKey): string {
  return key === 'home' ? '/' : routePath('en-us', key);
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
