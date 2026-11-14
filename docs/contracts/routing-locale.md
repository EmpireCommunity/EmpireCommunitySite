# Contract: routing, locale and serving rules

- Version: 1. Owner: Alicerce. Consumers: Vitral (pages, selector, head tags), Forja (nginx, build scripts), Guindaste
  (Cloudflare rules, compose), Ensaio (C-3, C-5, C-8), Sentinela (headers, CSP).
- Decisions: D-2 (two locales), D-3 (WhatsApp pt-BR only), D-8 (sitemap, robots, llms.txt, Web Analytics), D-15
  (country-based root), D-29 (`/discord` is the public address of the community entry), D-41 (the entry shows the community rules and releases the join links), D-78 (one gate page per language; `/discord` is a 302 by country like `/`; amends D-41 and replaces the "not a rule" part of D-29). Rationale for the rules: [ADR-0002](../adr/0002-locale-entry-routing.md).

## 1. URL space

Locale path segments are `pt-br` and `en-us`; the `lang` attribute and `hreflang` values are `pt-BR` and `en-US`
(Astro `i18n.locales` with `{ path, codes }`). Every URL ends with a slash (`trailingSlash: 'always'`,
`build.format: 'directory'`).

| Route key | pt-BR URL | en-US URL |
|---|---|---|
| home | `/pt-br/` | `/en-us/` |
| projects | `/pt-br/projects/` | `/en-us/projects/` |
| game-servers | `/pt-br/game-servers/` | `/en-us/game-servers/` |
| join | `/pt-br/join/` | `/en-us/join/` |
| support | `/pt-br/support/` | `/en-us/support/` |
| organization | `/pt-br/organization/` | `/en-us/organization/` |
| terms | `/pt-br/terms-of-service/` | `/en-us/terms-of-service/` |
| privacy | `/pt-br/privacy-policy/` | `/en-us/privacy-policy/` |
| discord (gate, D-78) | `/pt-br/discord/` | `/en-us/discord/` |

- **Slugs are identical in both locales and are English**, so the selector and `hreflang` map a page by swapping the
  first segment. The route keys and slugs live in one module (`src/lib/routes.ts`); nothing else hardcodes a URL.
- Every route exists in both locales (C-3). The build fails if a route key has no page in one locale.
- Join page content differs by audience (WhatsApp pt-BR only, C-1), the URL does not.
- The `discord` route is a locale page but not a header menu item. Every join button or call to action on a locale page
  links to the gate page of its own locale (`/{locale}/discord/`, from `routes.ts`; D-41, D-78), never to `/discord`,
  Discord or WhatsApp directly. The WhatsApp community link and the Discord invite exist only on the gate pages (the
  WhatsApp link on the pt-BR one only).

### Reserved and special paths

| Path | Owner | Behavior |
|---|---|---|
| `/` | Cloudflare rules, origin fallback | 302 to a locale tree (section 3). Origin serves the chooser page with HTTP 200 if the rules are off. |
| `/discord`, `/discord/` | Cloudflare rules R3 and R4, origin fallback (D-78) | The public address of the community entry. 302 to the gate page of the visitor's language (section 3). Origin serves the chooser with HTTP 200 if the rules are off. Used by links outside the site; the site's own buttons point at the gate pages. See "`/discord` and the gate pages" below. |
| `/donations/` (everything under it) | Traefik router of the donations service (`Host` and `PathPrefix`, donations contract section 2) | Reserved at opening (P2-09). The site's nginx never sees these paths and the build writes nothing under `donations/` (`check-dist` fails on it); no page, redirect or rule of the site may use the prefix. The support form posts to `/donations/api/v1/checkout` and the panel reads `/donations/api/v1/transparency`, both same origin. |
| `/data/members.json` | Worker, origin fallback | [members-json](members-json.md) |
| `/sitemap-index.xml`, `/sitemap-0.xml` | build | section 5 |
| `/robots.txt`, `/llms.txt` | build | section 5 |
| `/healthz` | nginx | `200 ok`, `Cache-Control: no-store`, not logged |
| `/404.html` | build | neutral bilingual page (`<html lang="en-US">`, other language marked per element) with links to both locales, served with status 404 for any unknown path |
| `/_astro/*` | build | hashed assets |
| `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`, `/manifest.webmanifest` | build (`public/`) | static |

A path without a locale prefix (for example `/projects/`) is a 404. There are no redirects from old or guessed URLs.
`/` and `/discord` are the two deliberate exceptions to the locale prefix (both are redirects by country, D-15, D-78).

### `/discord` and the gate pages (D-29, D-41, D-78)

Two things carry the name and must not be confused:

- **`/discord` is the public address**, used outside the site (organization profile, README badge, D-49). It is not
  content. Cloudflare rules R3 and R4 (section 3) answer it with a 302 to the gate page in the visitor's language, as
  `/` does for the home pages. `/discord/` (with the slash) is handled the same way.
- **`/pt-br/discord/` and `/en-us/discord/` are the gate pages** (route key `discord`, one language per page). They show
  the community rules and, after a checkbox, the join links. D-78 replaced the single bilingual page of D-41 with these
  two. They are ordinary locale pages with the locale header and footer, so the language selector works on them like on
  any other page (same route key, first segment swapped); no header menu item is marked current.

**Origin fallback for `/discord` (rules off or direct origin access).** `src/pages/discord.astro` builds
`dist/discord/index.html`, a static **chooser**: HTTP 200, `<html lang="en-US">`, two links (`/pt-br/discord/`,
`/en-us/discord/`) with the names `Português (Brasil)` and `English` in their own language and a `lang` on each, the same
markup rules as the root chooser (section 3), `<meta name="robots" content="noindex">`, no `hreflang` alternates and no
canonical (it is not a page of a language pair), **no script, no invite, no WhatsApp reference and no rules text**. nginx
serves `/discord` from its own exact location (section 6) and `/discord/` through `location /`; both answer 200 with
the chooser, so an old link never breaks. The `<meta http-equiv="refresh">` of D-29 stays removed.

**Gate pages, what they share (D-41 carried over, one gate group per page):**

- **What a page shows.** The community rules and the date they were last updated (2025-02-27 at the time of D-41),
  formatted for the page language, then one checkbox with its label confirming agreement, then the join links:
  **Discord** on both pages and **WhatsApp** on the pt-BR page only (**the en-US page has the Discord link only**, C-1).
  Rules text and date come from `src/data/community-rules.yaml` (one source, site-data section 14). The WhatsApp community
  link comes from the `whatsapp` entry of `join-channels.yaml` (one source, site-data section 8) and is read only by the
  pt-BR page. The invite code comes only from `src/data/site.yaml` (`discord.inviteCode`, site-data section 4), the
  approved invite, and is the value the integrity check compares with the Worker repository's copy (members-json 2.6).
  The superseded invite is not kept anywhere in the repository. No WhatsApp reference (the word or the URL) appears in a
  `<head>` (title, description, Open Graph) on any page, and none appears on the en-US page.
- **Structure.** `<html lang>` is the page's own language; `<main>` holds exactly one gate group, in that language.
  Order, columns and visual treatment are Bússola's, not this contract's.
- **The gate is CSS only.** No script, no `<form>`, no `<noscript>`. The gate group is an
  `<input type="checkbox">` with `id`, `autocomplete="off"` and **no `name`**, a `<label for>`, and the join links as
  the checkbox's following content inside the same group (so the next tab stop after the checkbox is the first
  link). The links are hidden with `display: none` (or `visibility: hidden`) until the checkbox is checked, using
  `:has()` inside `@supports selector(:has(*))`, for example
  `.gate:not(:has(.agree:checked)) .links { display: none }`. `display: none` removes the links from the tab order and
  from assistive technology; `opacity` or `pointer-events` alone do not and are not accepted. **Without `:has()` the
  `@supports` block does not apply and the links stay visible and usable**, which is the intended fallback. Unchecking
  hides them again. Because there is no script, the reveal is not announced to a screen reader; the label wording
  (Bússola) tells the visitor that the links appear after the box.
- **The checkbox is a UX confirmation and nothing else.** It records nothing: no cookie, no `localStorage` or
  `sessionStorage`, no request, no server state, and the page sends no data. It is **bypassable by design** (view
  source, a stylesheet override, CSS off, a browser without `:has()`, or an invite shared by someone else), and the
  gate is not a control the project relies on for anything. The page copy must not say or imply that agreement is
  recorded, verified or enforced. The community rules are enforced by moderation on the server, not by this page.
- **Query-blind.** The page is static, so a query string is ignored and **never forwarded**: the link targets are
  fixed at build time (`https://discord.com/invite/<inviteCode>` and the WhatsApp community link) and are the same with
  or without a query. A query that reaches `/discord` is carried by R3 and R4 to the gate page and stops there.
- **Not an indexable page:** `<meta name="robots" content="noindex">` and absent from the sitemap (section 5). The
  other head rules of section 4 apply (own canonical, reciprocal `hreflang`, `og:locale`) so the selector and the
  equivalent-page mapping need no special case. No analytics snippet and **no script of any kind** (Privacy clause 4
  says the community rules page is not counted). It uses the **default** headers and CSP of section 6 (no new policy
  entry): the gate CSS lives in the shared external stylesheet, with no inline style. External links carry
  `rel="noopener noreferrer"`.
- **Links inside the site go straight to the gate page** (`/{locale}/discord/`, section 1), never through `/discord`,
  so a visitor on the site is not geolocated again and keeps the language the selector gave them.
- **Changing the invite or the rules** is a pull request (`discord.inviteCode`, or `community-rules.yaml` with a new
  `updatedOn`), merged and deployed through [deploy](deploy.md); the Worker follows an invite change through its own
  repository and deploy (members-json 2.6, D-55). No dashboard step.
- Checks: the build scans of site-data section 12 (invite URL pattern, WhatsApp scope, page structure for both gate
  pages and the chooser), the HTTP test of section 6, a browser test of the gate (section 7, C-9), the rules test
  (section 7, C-10) and the integrity monitor of [deploy](deploy.md) section 8.

## 2. Language selector (no cookie)

- A component rendered in the header of every page: two plain `<a>` elements, one per locale, each with `href` set to
  the **equivalent page in that locale** (same route key), `hreflang`, `lang`, and the visible name in its own
  language (`Português`, `English`). The current one has `aria-current="true"`.
- No JavaScript, no cookie, no `localStorage` or `sessionStorage`, no redirect, no dependence on `/`. Choosing a
  language is following a link; the URL is the state.
- On the home pages the selector links to `/pt-br/` and `/en-us/`, not to `/`.
- The selector never mentions WhatsApp, and the en-US selector target for join is the en-US join page.
- Accessibility: reachable by keyboard, visible focus, labelled (`nav` with `aria-label` in the page language).

## 3. Root `/` and `/discord`: language by visitor country (D-15, D-78)

Implemented as four **Cloudflare Single Redirects** on the zone `empirecommunity.org` (Rules > Redirect Rules, Free
plan allows 10; this uses 4: R1 and R2 for `/`, R3 and R4 for `/discord`). Status code **302**, **preserve query string:
on**, static target. The `/data/` custom and rate-limit rules of members-json 2.9 are other products and do not count here.

| # | Expression (rules language) | Target (static) |
|---|---|---|
| R1 | `http.host eq "empirecommunity.org" and http.request.uri.path eq "/" and ip.src.country eq "BR"` | `https://empirecommunity.org/pt-br/` |
| R2 | `http.host eq "empirecommunity.org" and http.request.uri.path eq "/" and ip.src.country ne "BR"` | `https://empirecommunity.org/en-us/` |
| R3 | `http.host eq "empirecommunity.org" and (http.request.uri.path eq "/discord" or http.request.uri.path eq "/discord/") and ip.src.country eq "BR"` | `https://empirecommunity.org/pt-br/discord/` |
| R4 | `http.host eq "empirecommunity.org" and (http.request.uri.path eq "/discord" or http.request.uri.path eq "/discord/") and ip.src.country ne "BR"` | `https://empirecommunity.org/en-us/discord/` |

- `ip.src.country` is the ISO 3166-1 alpha-2 code. Unknown and special values (for example Tor, `T1`) are not `BR`,
  so they get `/en-us/`.
- Only the exact paths match (`/` for R1 and R2; `/discord` and `/discord/` for R3 and R4), so no other URL is affected:
  `/Discord`, `/discord/x` and every locale URL are untouched, and the targets do not match their own rules, so there
  is no loop. `www` is not covered (open point).
- **Preserve query string.** With the option on, Cloudflare puts the original query on the target and discards any query
  written in the target; the four targets have none. A campaign parameter on `/discord?utm_source=x` therefore reaches
  the gate page and is ignored there (routing-locale, gate pages).
- **Prerequisite.** Single Redirects only apply to traffic proxied by Cloudflare for the hostname (Cloudflare docs, Single
  Redirects, proxied DNS records). The apex record must be proxied (orange cloud); on 2026-11-12 the live site answered
  through Cloudflare (`server: cloudflare`, a `cf-ray` header) and `/` answered 200 from the origin, which shows that no
  redirect rule was active yet.
- **Order of work (owner).** Create and test R1 and R2 first (C-8). Create R3 and R4 only after R1 and R2 redirect as
  specified, then run C-10. If R1 or R2 does not redirect, stop and report: R3 and R4 would fail for the same reason, and
  the chooser pages keep every address working meanwhile.
- Never 301: a permanent redirect is cached by browsers and would lock the visitor into one language.
- **Caching:** Single Redirects run before Cache Rules in Cloudflare's execution order, and Cloudflare does not cache
  HTML by default. Do not create a Cache Rule that matches `/`. The redirect response carries no cache headers from
  us; browsers do not cache a 302 without them.
- **Crawlers:** not exempted (see ADR-0002). Search engines see `/` redirect to `/en-us/` when they crawl from the
  US, and reach `/pt-br/` through the sitemap, internal links and `hreflang`. The gate pages are `noindex` and not in the
  sitemap, so what `/discord` redirects to is irrelevant to search.
- **Fallback chooser** (`src/pages/index.astro`, outside the locale folders, `redirectToDefaultLocale` left at its
  default `false`): static page, HTTP 200, two links (`/pt-br/`, `/en-us/`) with names in their own language, a
  `<link rel="alternate" hreflang="x-default" href="https://empirecommunity.org/">`, `<html lang="en-US">` (the
  `x-default` language, so the page has a language as WCAG 3.1.1 requires) and a `lang` on every link or text in the
  other language. The bilingual 404 page and the `/discord` chooser follow the same rule. No script. The root chooser is shown only when R1 and R2 are off or on direct origin access, the `/discord` chooser only when R3 and R4 are.
- **Source of truth:** these expressions (R1 to R4). The dashboard is not versioned, so Guindaste copies them into the Ops
  Runbook with the date applied; any change is made here first.
- **Test plan (C-8):** from a Brazilian network, `curl -sI https://empirecommunity.org/?utm_source=t` must answer
  `302` with `location: https://empirecommunity.org/pt-br/?utm_source=t`. From a non-Brazilian network (or the
  Cloudflare Rules trace tool if it can set the country; not verified) expect `/en-us/?utm_source=t`.
  `curl -sI https://empirecommunity.org/pt-br/` must be 200 with no redirect (no loop). The scheduled integrity check
  in [deploy](deploy.md) section 8 repeats the non-Brazilian case.
- **Test plan (C-10, `/discord`):** from a Brazilian network, `curl -sI "https://empirecommunity.org/discord?utm_source=t"`
  must answer `302` with `location: https://empirecommunity.org/pt-br/discord/?utm_source=t`, and the same for
  `/discord/`. From a non-Brazilian network expect `/en-us/discord/?utm_source=t`. `curl -sI` of `/pt-br/discord/` and
  `/en-us/discord/` must be 200 with no `Location` (no loop), `/discord/x` and `/Discord` must be 404, and with the
  rules off `/discord` must be the chooser (200). The scheduled integrity check repeats the non-Brazilian case.

## 4. Page head rules (every locale page)

- `<html lang="pt-BR">` or `<html lang="en-US">`.
- `<link rel="canonical">` to its own absolute URL (`https://empirecommunity.org/...`, trailing slash).
- Reciprocal `hreflang` alternates, absolute URLs, on every page, including itself:
  `pt-BR`, `en-US`, and `x-default`. `x-default` is `https://empirecommunity.org/` on the two home pages and the
  **en-US** page on inner pages (everyone who is not Brazilian is served English, D-15).
- Open Graph and `og:locale` (`pt_BR`, `en_US`) per page; `og:locale:alternate` for the other.
- The en-US HTML, `hreflang` data, JSON-LD, `og` tags and `llms.txt` MUST NOT contain the WhatsApp link or the word
  WhatsApp (C-1). A post-build script scans `dist/en-us/**` (which now includes `/en-us/discord/`), `dist/llms.txt`, `dist/index.html`
  and `dist/discord/index.html` (the chooser) and fails the build. WhatsApp appears on exactly one gate page,
  `/pt-br/discord/` ("`/discord` and the gate pages" above, checked as in site-data section 12).
- Page `title` and `description` are required per locale in the page data (site-data).

## 5. Discovery files

- **Sitemap:** `@astrojs/sitemap` with its `i18n` option (`defaultLocale: 'pt-br'`,
  `locales: { 'pt-br': 'pt-BR', 'en-us': 'en-US' }`), plus a `filter` that keeps only the URLs under a locale home (`/pt-br/`, `/en-us/`) **and drops the `discord` route**
  (`/pt-br/discord/`, `/en-us/discord/`, which would otherwise pass the prefix test), so `/`, `/404.html`, `/discord/` and
  the two gate pages never appear. All locale URLs are listed. `x-default` is carried by the HTML tags (Google accepts HTML or sitemap, one method is enough; they
  must agree).
- **robots.txt:** `User-agent: *`, `Allow: /`, `Sitemap: https://empirecommunity.org/sitemap-index.xml`. `/data/` is
  not disallowed.
- **llms.txt:** one file at the root, English, describing the community and linking the en-US pages (not the gate
  page, which is `noindex`). No WhatsApp.
- **Cloudflare Web Analytics:** use the **manual JS snippet** in the layout (the token is public), never automatic
  injection, so the CSP can be tested before deploy. The snippet is **not included on the support pages**
  (`/pt-br/support/`, `/en-us/support/`), which are the pages that will carry payment-related content once donations open (D-28); the strict setting applies from launch; opening them loosens only `form-action` (section 6). Never send `Cache-Control: ... no-transform`
  (it blocks automatic injection per Cloudflare's FAQ; harmless here but keep it out).
- **Cloudflare features that rewrite HTML are off for the zone** (a required setup item, copied by Guindaste into the
  Ops Runbook with the date): **Email Address Obfuscation** (it replaces visible e-mail addresses in the HTML, which
  would alter contact addresses), **Rocket Loader** (it rewrites script loading and conflicts with
  the CSP), and **automatic Web Analytics injection**. Any other feature that modifies delivered HTML is also off.
  The integrity check in [deploy](deploy.md) section 8 checks the delivered support page for the expected state block and no payment marker, so a
  re-enabled feature is detected.

## 6. nginx (`nginxinc/nginx-unprivileged`, port 8080)

The image ships its own `nginx.conf` and one server block. Logging follows D-20: **no access log**, a minimal error
log to stdout.

```
# nginx.conf (main context)
error_log /dev/stderr error;
pid /tmp/nginx.pid;
# http context
access_log off;
server_tokens off;

# server block
absolute_redirect off;            # trailing-slash redirects stay relative behind the proxy
port_in_redirect off;
root /usr/share/nginx/html;
index index.html;
gzip_static on;                   # build precompresses .gz; Cloudflare adds brotli at the edge
error_page 404 /404.html;

location = /healthz {
  include snippets/limit-methods.conf;
  include snippets/security-headers.conf;
  add_header Cache-Control "no-store" always; default_type text/plain; return 200 "ok\n";
}
location /_astro/ {
  include snippets/limit-methods.conf;
  include snippets/security-headers.conf;
  add_header Cache-Control "public, max-age=31536000, immutable" always; try_files $uri =404;
}
location = /data/members.json {
  include snippets/limit-methods.conf;      # first: a non-GET method answers 405 before any other rule
  if ($args != "") { return 404; }          # a query string never reaches the file (members-json 2.9)
  include snippets/security-headers.conf;
  add_header Cache-Control "public, max-age=300" always; try_files $uri =404;
}
location = /discord {                       # D-78: fallback chooser when R3/R4 are off; served directly, 200, no redirect
  include snippets/limit-methods.conf;
  include snippets/security-headers.conf;
  add_header Cache-Control "no-cache" always; try_files /discord/index.html =404;
}
location / {
  include snippets/limit-methods.conf;
  include snippets/security-headers.conf;
  add_header Cache-Control "no-cache" always; try_files $uri $uri/ =404;   # directory URLs without a slash are redirected
}
```

### Header inheritance rule

nginx drops every `add_header` inherited from the server level as soon as a location defines its own `add_header`.
Therefore **no header is set at server level**: `snippets/security-headers.conf` holds all security headers (below)
and **every location that sets any header includes it**, as above. `always` is used so that error responses carry
the headers too, and the `404.html` page is served from a location that includes it. A new location is not accepted
without the include; the HTTP test below enforces it.

`snippets/limit-methods.conf` (included first in every location, before any other `if` or `return`, so the method check
decides first):

```
if ($request_method !~ ^(GET|HEAD)$) { return 405; }
```

It is an `if` with `return`, not `limit_except`: nginx runs the rewrite-module directives of a location (including
`return`) in sequence before the access phase, so `limit_except` cannot protect a location that answers with `return`
(such as `/healthz`), and it answers 403 rather than 405.

`snippets/security-headers.conf`:

```
add_header Content-Security-Policy $csp_policy always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
```

`$csp_policy` comes from one `map $uri $csp_policy` in the http context, with two values:

| Paths | Content-Security-Policy |
|---|---|
| default | `default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` |
| `^/(pt-br\|en-us)/support(/\|$)` | `default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self' https://www.mercadopago.com.br; frame-ancestors 'none'` |

- The support pattern also matches `/pt-br/support` and `/en-us/support` without the slash, so the 301 to the slash form
  already carries the support policy (the HTTP test asserts it).
- The support pages have **no Cloudflare analytics hosts** in their CSP and carry no beacon. `data:` is **not** allowed
  in `img-src` anywhere; an inline `<svg>` element is markup, not an image request, and is not affected. The
  support-page policy is the baseline of the donation contract (P2-09): its only loosening is `form-action 'self' https://www.mercadopago.com.br`. The form posts to the donations service (`'self'`), which answers `303` to the one host of its allowlist, and browsers apply `form-action` to that redirect (T-56 m1); the directive is a header, so the HTML never names the payment host (payment guard, site-data section 10). The support pages also carry `<meta name="referrer" content="no-referrer">`, because the return from a payment carries identifiers in its address; `connect-src 'self'` already covers the panel's snapshot request.
- The Cloudflare hosts in the default policy are what the Web Analytics beacon uses to load and report; Cloudflare's
  documentation checked here does not list them, so Ensaio verifies C-5 against the real snippet and adjusts.
- The proxy layer in front of the origin adds `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin` and HSTS; nginx does not repeat them. The HTTP test below, run against the public
  URL, confirms they arrive.
- A strict CSP without `unsafe-inline` requires: no inline `<style>` or `style=""`, no inline `<script>` (JSON-LD
  `application/ld+json` blocks are data and allowed). Enforced by the Astro settings in ADR-0001 plus a post-build
  check that fails on inline executable scripts or style attributes in `dist/**/*.html`.
- Only `GET` and `HEAD`, enforced in **every** location by `snippets/limit-methods.conf` (405, below). No directory
  listing, no `autoindex`, no proxying, no upstream.
- **Trailing slash.** A locale URL without the slash (`/pt-br/join`) gets nginx's directory redirect to the slash form
  (`try_files $uri $uri/ =404`; relative `Location`, because `absolute_redirect off`). `/discord` has its own exact
  location and is served directly with 200 and no redirect; `/discord/` is served by `location /`. Both return the
  chooser. Behind Cloudflare with R3 and R4 on, neither reaches the origin.

### Logging (D-20)

- No access log at the origin. The error log is the minimal `error` level to stdout, kept by a size-capped,
  short-rotated json-file driver (limits in [deploy](deploy.md)) and lost when the container is recreated. It can
  contain a client address when an error occurs; the Privacy text says so (site-data section 11).
- This site makes **no promise of a fixed retention period for access logs**, and no contract may state one.

### HTTP header test (required check)

Run in CI against the built image, and again against the public URL after a deploy. For each of `/pt-br/`,
`/en-us/support/`, `/pt-br/discord/`, `/en-us/discord/`, `/discord`, an unknown path (status 404), a hashed file under `/_astro/`, `/data/members.json` and `/healthz`,
assert:

- `Content-Security-Policy` is present and equals the policy for that path (the support pages have no Cloudflare
  hosts), `Permissions-Policy` and `Cross-Origin-Opener-Policy` are present;
- `Cache-Control` matches the location's value;
- `/data/members.json?x=1` returns 404 and a non-GET method returns 405 on every path tested, including `POST /healthz`;
  `/pt-br/join` (no slash) answers a redirect to `/pt-br/join/` and `/pt-br/join/` answers 200; both gate pages return 200 with
  no `Location` header and their join links are identical with or without a query string; against the **built image**
  `/discord` and `/discord/` return 200 with no `Location` (the chooser; the rules do not exist there), while against the
  public URL, once R3 and R4 are applied (the `root` launch flag, deploy section 8), they answer as C-10 says, so the test
  asserts the chooser on the image and the 302 on the public URL;
- no `Server` version string and no `Set-Cookie` anywhere;
- against the public URL: `X-Content-Type-Options`, `Referrer-Policy` and `Strict-Transport-Security` are present.

## 7. Acceptance hooks

| Id | Check |
|---|---|
| C-3 | Build script compares the page set per locale; every route key has both. |
| C-1 | Post-build scan described in section 4. |
| C-5 | Sitemap and robots lint; `hreflang` reciprocity check script over `dist/`; Web Analytics under the CSP in a browser test; the HTTP header test of section 6. |
| C-8 | Section 3 test plan, plus a browser test that the selector changes locale and survives a reload with cookies and storage disabled. |
| C-9 | Browser test of the gate on `/pt-br/discord/` and `/en-us/discord/` (Ensaio), in a browser with `:has()` support and JavaScript disabled: with the box unchecked, no join link is visible or reachable by Tab; after checking, the pt-BR page shows the Discord and WhatsApp links and the en-US page the Discord link only; unchecking hides them again; after a reload the box is unchecked; no cookie, storage entry or request is made by ticking it. The build checks of site-data section 12 cover the page structure. |
| C-10 | Section 3 test plan for `/discord` (R3, R4), run by the owner or Guindaste after the rules exist; the scheduled integrity check repeats the non-Brazilian case. |
