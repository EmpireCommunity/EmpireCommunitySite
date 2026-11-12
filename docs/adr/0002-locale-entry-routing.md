# ADR-0002: Language choice at the site root and at `/discord`

- Status: Proposed. Owner ruling D-15 (2026-11-08): `/` picks the language by visitor location, Brazil to `/pt-br/`,
  everyone else to `/en-us/`; the language selector stays visible and works without a cookie. Amended by D-78
  (2026-11-12, T-71): `/discord` takes the same mechanism (section "Amendment" below).
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
- Four rules in the dashboard, out of ten: R1 and R2 for `/`, R3 and R4 for `/discord` (D-78, below). The first version
  of this ADR said `/discord` was a page and not a rule (D-29, D-41); D-78 replaced that.
- `/` is not in the sitemap and is never a canonical page; `x-default` on the home page points to it, on inner pages
  to the en-US page.
- Privacy page: the country is derived by Cloudflare at the edge from the IP address; the site stores nothing. The
  legal drafter must mention Cloudflare processing.

## Amendment: `/discord` by country (D-78, T-71, 2026-11-12)

**Context.** D-41 made `/discord` one bilingual page, which forced two language containers, a `<head>` fixed to en-US
and a selector that could not map the page to its other language. The owner's review of the live rc (D-78) asked for one
language per page. The public address `/discord` is used outside the site (organization profile, README, D-49) and must
keep working.

**Decision.** Same mechanism and same reasoning as the root, applied to a second exact path:

- `/pt-br/discord/` and `/en-us/discord/` are ordinary locale pages (the gate pages, routing-locale).
- `/discord` and `/discord/` get two more Single Redirects: Brazil to `/pt-br/discord/`, everyone else to
  `/en-us/discord/`; 302; query preserved (R3 and R4, routing-locale section 3).
- Fail-safe: the origin serves a neutral chooser at `/discord` (HTTP 200, two links, `noindex`), the counterpart of the
  chooser at `/`. If the rules are off, an old link shows two language links and never a 404.
- Buttons and links on the site go straight to `/{locale}/discord/`, so a visitor who chose a language is not
  geolocated again.
- Options rejected: keeping one bilingual page (the owner's request); a Worker or nginx country header (the reasons of
  options 2 and 3 above apply unchanged); a second `Accept-Language` branch (D-15).

**The D-29 rule that "did not work".** D-29 records that a Cloudflare rule for `/discord` "was reported not to work", and
chose a page instead. No cause was recorded anywhere in the repository, the notes or the history: the first contract
said that rule was "approved, not yet applied", so the failure report came from the owner's side and **its cause is
unknown**. This amendment therefore does not claim to have fixed it; it states what is now known and how to find out
quickly:

- Cloudflare's documentation says Single Redirects apply only to traffic proxied by Cloudflare for the hostname. On
  2026-11-12 the apex answers through Cloudflare (`server: cloudflare`, a `cf-ray` header). Whether it was proxied on
  2026-11-09, before the site went live, is not known; an unproxied record is the most likely cause, and it is a
  hypothesis, not a finding.
- Edge rules on this zone already work: the `/data/` rate limit and the query-refusing custom rule were applied on
  2026-11-11 and verified (Ops Runbook). That proves the rules engine and the zone, not the redirect type.
- No redirect has been demonstrated on this zone yet: `/` answered 200 on 2026-11-12, so R1 and R2 do not exist. The
  first redirect the owner creates is therefore the real test. Order of work: R1 and R2 first, then R3 and R4 only if
  they redirect (routing-locale section 3).
- If a redirect rule still does not work, the choosers keep every address working, and the next options are the ones
  rejected above (a Worker route for the two paths, or an nginx decision on `CF-IPCountry`), each needing a new
  decision.

**Consequences.** Four dashboard rules instead of two; the integrity monitor repeats the non-Brazilian `/discord` case
next to the root one (deploy section 8); the sitemap filter must drop the `discord` route; join buttons no longer point
at `links.discord` (site-data sections 4 and 8). The privacy text that names the community rules page (`/discord`) stays
true: that address still reaches the page.

## Not verified

- That a request from a Brazilian network reports `BR` and a VPN or the Cloudflare Rules trace tool can emulate a
  foreign country. The test plan in routing-locale proposes both; Ensaio confirms.
- That any Cloudflare redirect rule works on this zone (none exists yet), and why the D-29 rule failed (see the
  amendment). R1 and R2, then R3 and R4, settle it.
- The `or` with parentheses in the R3 and R4 expressions was written from the rules language and not run in the
  dashboard; the owner pastes the expression and the dashboard validates it.
