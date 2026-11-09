# ADR-0002: Language choice at the site root

- Status: Proposed. Owner ruling D-15 (2026-11-08): `/` picks the language by visitor location, Brazil to `/pt-br/`,
  everyone else to `/en-us/`; the language selector stays visible and works without a cookie.
- Author: Alicerce. Task ref: T-4. Spec: [routing-locale](../contracts/routing-locale.md).

## Context

The site has two locale trees, `/pt-br/` and `/en-us/`. About 99% of the audience is Brazilian; foreign visitors come
from GitHub and are served in English. The owner wants the bare domain to send each visitor to the right tree by
country, not by browser language (this replaces the earlier Accept-Language idea).

Facts checked in official documentation on 2026-11-08:

- Cloudflare Single Redirects are available on every plan (Free: 10 rules, wildcard support, no regex). The field
  `ip.src.country` holds the ISO 3166-1 alpha-2 country code. In the Rules execution order, Single Redirects run
  before Cache Rules, so a rule-generated redirect is decided before any cache lookup. Cloudflare does not cache HTML
  or JSON by default (default cached extensions only).
- Cloudflare's default edge TTL applies to origin responses: 301 for 120 minutes, 302 for 20 minutes when the origin
  sends no cache headers. A redirect created by a rule is not an origin response.
- Google Search Central, "Managing multi-regional and multilingual sites": avoid automatically redirecting users
  based on perceived language or IP; "IP location analysis is difficult and generally not reliable" and "most, but
  not all, Google crawls originate from the US". The same guidance asks for links on every page so users can pick a
  language, recommends separate URLs per language with `hreflang`, and recommends `x-default` as the fallback for
  language selectors or auto-redirecting home pages.

## Options

1. **Cloudflare Single Redirect rules on the zone (chosen).** Edge, no origin hop, no Worker request quota, no code,
   two rules out of ten. Evaluated before the origin and before caching.
2. **Worker on `/`.** Same result with code and a request counted against the Free limit of 100,000 per day. No gain.
3. **nginx with `CF-IPCountry` header.** Couples the decision to origin availability and to trusting a header
   through the proxy layer; adds config in the container for no benefit.
4. **Browser language or JavaScript detection.** Rejected by the owner (D-15) and discouraged by Google.

## Decision

Option 1, scoped to the exact path `/`:

- Country is BR: temporary redirect (302) to `/pt-br/`. Any other value, including unknown and Tor: 302 to `/en-us/`.
- The query string is preserved (campaign parameters must survive for paid search, D-8).
- Never a 301: browsers cache permanent redirects and would lock a visitor into one language.
- No cookie, no storage. Only `/` is affected, so every other URL is stable and can be shared and indexed. A visitor
  who picks the other language with the selector stays there because the selector links straight to the locale
  tree.
- Crawlers are **not** exempted. A Googlebot from the US lands on `/en-us/` from `/`; this is acceptable because the
  indexable URLs are the locale pages, which reference each other with `hreflang`, are linked internally and are
  listed in the sitemap. Special-casing bots adds a branch that looks like cloaking and needs a bot field whose plan
  availability we have not verified.
- Fail-safe: the origin serves a static chooser page at `/` (HTTP 200, links to both locales, `hreflang`
  `x-default` target). It is what a visitor sees if the rules are disabled or removed.

## Consequences

- The rules live in the Cloudflare dashboard, not in the repository. The expressions are specified in routing-locale
  and Guindaste copies them into the Ops Runbook. A silent change in Cloudflare cannot be caught by the site's CI; the
  acceptance test C-8 and a smoke test from a Brazilian and a non-Brazilian address do that.
- A Brazilian visitor who prefers English, or a VPN user, gets the wrong language once and fixes it with the
  selector. This is the accepted cost of D-15.
- `/` is not in the sitemap and is never a canonical page; `x-default` on the home page points to it, on inner pages
  to the en-US page.
- Privacy page: the country is derived by Cloudflare at the edge from the IP address; the site stores nothing. The
  legal drafter must mention Cloudflare processing.

## Not verified

- That a request from a Brazilian network reports `BR` and a VPN or the Cloudflare Rules trace tool can emulate a
  foreign country. The test plan in routing-locale proposes both; Ensaio confirms.
