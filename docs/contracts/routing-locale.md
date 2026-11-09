# Contract: routing, locale and serving rules

- Version: 1. Owner: Alicerce. Consumers: Vitral (pages, selector, head tags), Forja (nginx, build scripts), Guindaste
  (Cloudflare rules, compose), Ensaio (C-3, C-5, C-8), Sentinela (headers, CSP).
- Decisions: D-2 (two locales), D-3 (WhatsApp pt-BR only), D-8 (sitemap, robots, llms.txt, Web Analytics), D-15
  (country-based root). Rationale for the root: [ADR-0002](../adr/0002-locale-entry-routing.md).

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

- **Slugs are identical in both locales and are English**, so the selector and `hreflang` map a page by swapping the
  first segment. The route keys and slugs live in one module (`src/lib/routes.ts`); nothing else hardcodes a URL.
- Every route exists in both locales (C-3). The build fails if a route key has no page in one locale.
- Join page content differs by audience (WhatsApp pt-BR only, C-1), the URL does not.

### Reserved and special paths

| Path | Owner | Behavior |
|---|---|---|
| `/` | Cloudflare rules, origin fallback | 302 to a locale tree (section 3). Origin serves the chooser page with HTTP 200 if the rules are off. |
| `/discord` | Cloudflare redirect rule (approved, not yet applied) | Redirect to the current invite. Recommended 302 (the invite may change). The site never links anywhere else for Discord. nginx has no rule for it. |
| `/data/members.json` | Worker, origin fallback | [members-json](members-json.md) |
| `/sitemap-index.xml`, `/sitemap-0.xml` | build | section 5 |
| `/robots.txt`, `/llms.txt` | build | section 5 |
| `/healthz` | nginx | `200 ok`, `Cache-Control: no-store`, not logged |
| `/404.html` | build | neutral bilingual page with links to both locales, served with status 404 for any unknown path |
| `/_astro/*` | build | hashed assets |
| `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`, `/manifest.webmanifest` | build (`public/`) | static |

A path without a locale prefix (for example `/projects/`) is a 404. There are no redirects from old or guessed URLs.

## 2. Language selector (no cookie)

- A component rendered in the header of every page: two plain `<a>` elements, one per locale, each with `href` set to
  the **equivalent page in that locale** (same route key), `hreflang`, `lang`, and the visible name in its own
  language (`Português`, `English`). The current one has `aria-current="true"`.
- No JavaScript, no cookie, no `localStorage` or `sessionStorage`, no redirect, no dependence on `/`. Choosing a
  language is following a link; the URL is the state.
- On the home pages the selector links to `/pt-br/` and `/en-us/`, not to `/`.
- The selector never mentions WhatsApp, and the en-US selector target for join is the en-US join page.
- Accessibility: reachable by keyboard, visible focus, labelled (`nav` with `aria-label` in the page language).

## 3. Root `/`: language by visitor country (D-15)

Implemented as two **Cloudflare Single Redirects** on the zone `empirecommunity.org` (Rules > Redirect Rules, Free
plan allows 10; this uses 2, plus 1 for `/discord`). Status code **302**, **preserve query string: on**.

| # | Expression (rules language) | Target (static) |
|---|---|---|
| R1 | `http.host eq "empirecommunity.org" and http.request.uri.path eq "/" and ip.src.country eq "BR"` | `https://empirecommunity.org/pt-br/` |
| R2 | `http.host eq "empirecommunity.org" and http.request.uri.path eq "/" and ip.src.country ne "BR"` | `https://empirecommunity.org/en-us/` |

- `ip.src.country` is the ISO 3166-1 alpha-2 code. Unknown and special values (for example Tor, `T1`) are not `BR`,
  so they get `/en-us/`.
- Only the exact path `/` matches, so no other URL is affected. `www` is not covered (open point).
- Never 301: a permanent redirect is cached by browsers and would lock the visitor into one language.
- **Caching:** Single Redirects run before Cache Rules in Cloudflare's execution order, and Cloudflare does not cache
  HTML by default. Do not create a Cache Rule that matches `/`. The redirect response carries no cache headers from
  us; browsers do not cache a 302 without them.
- **Crawlers:** not exempted (see ADR-0002). Search engines see `/` redirect to `/en-us/` when they crawl from the
  US, and reach `/pt-br/` through the sitemap, internal links and `hreflang`.
- **Fallback chooser** (`src/pages/index.astro`, outside the locale folders, `redirectToDefaultLocale` left at its
  default `false`): static page, HTTP 200, two links (`/pt-br/`, `/en-us/`) with names in their own language, a
  `<link rel="alternate" hreflang="x-default" href="https://empirecommunity.org/">`, `lang` unset on the container
  and set per link. No script. It is shown only when the rules are off or on direct origin access.
- **Source of truth:** these expressions. The dashboard is not versioned, so Guindaste copies them into the Ops
  Runbook with the date applied; any change is made here first.
- **Test plan (C-8):** from a Brazilian network, `curl -sI https://empirecommunity.org/?utm_source=t` must answer
  `302` with `location: https://empirecommunity.org/pt-br/?utm_source=t`. From a non-Brazilian network (or the
  Cloudflare Rules trace tool if it can set the country; not verified) expect `/en-us/?utm_source=t`.
  `curl -sI https://empirecommunity.org/pt-br/` must be 200 with no redirect (no loop). The scheduled integrity check
  in [deploy](deploy.md) section 8 repeats the non-Brazilian case.

## 4. Page head rules (every locale page)

- `<html lang="pt-BR">` or `<html lang="en-US">`.
- `<link rel="canonical">` to its own absolute URL (`https://empirecommunity.org/...`, trailing slash).
- Reciprocal `hreflang` alternates, absolute URLs, on every page, including itself:
  `pt-BR`, `en-US`, and `x-default`. `x-default` is `https://empirecommunity.org/` on the two home pages and the
  **en-US** page on inner pages (everyone who is not Brazilian is served English, D-15).
- Open Graph and `og:locale` (`pt_BR`, `en_US`) per page; `og:locale:alternate` for the other.
- The en-US HTML, `hreflang` data, JSON-LD, `og` tags and `llms.txt` MUST NOT contain the WhatsApp link or the word
  WhatsApp (C-1). A post-build script scans `dist/en-us/**`, `dist/llms.txt` and `dist/index.html` and fails the build.
- Page `title` and `description` are required per locale in the page data (site-data).

## 5. Discovery files

- **Sitemap:** `@astrojs/sitemap` with its `i18n` option (`defaultLocale: 'pt-br'`,
  `locales: { 'pt-br': 'pt-BR', 'en-us': 'en-US' }`), plus a `filter` that removes `/` and `/404.html`. All locale
  URLs are listed. `x-default` is carried by the HTML tags (Google accepts HTML or sitemap, one method is enough; they
  must agree).
- **robots.txt:** `User-agent: *`, `Allow: /`, `Sitemap: https://empirecommunity.org/sitemap-index.xml`. `/data/` is
  not disallowed.
- **llms.txt:** one file at the root, English, describing the community and linking the en-US pages. No WhatsApp.
- **Cloudflare Web Analytics:** use the **manual JS snippet** in the layout (the token is public), never automatic
  injection, so the CSP can be tested before deploy. The snippet is **not included on the support pages**
  (`/pt-br/support/`, `/en-us/support/`), which carry the payment key. Never send `Cache-Control: ... no-transform`
  (it blocks automatic injection per Cloudflare's FAQ; harmless here but keep it out).
- **Cloudflare features that rewrite HTML are off for the zone** (a required setup item, copied by Guindaste into the
  Ops Runbook with the date): **Email Address Obfuscation** (it replaces visible e-mail addresses in the HTML, which
  would alter an e-mail Pix key and contact addresses), **Rocket Loader** (it rewrites script loading and conflicts with
  the CSP), and **automatic Web Analytics injection**. Any other feature that modifies delivered HTML is also off.
  The integrity check in [deploy](deploy.md) section 8 compares the delivered Pix block with the built one, so a
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
  include snippets/security-headers.conf;
  add_header Cache-Control "no-store" always; return 200 "ok\n";
}
location /_astro/ {
  include snippets/security-headers.conf;
  add_header Cache-Control "public, max-age=31536000, immutable" always; try_files $uri =404;
}
location = /data/members.json {
  if ($args != "") { return 404; }          # a query string never reaches the file (members-json 2.9)
  include snippets/security-headers.conf;
  add_header Cache-Control "public, max-age=300" always; try_files $uri =404;
}
location / {
  limit_except GET HEAD { deny all; }
  include snippets/security-headers.conf;
  add_header Cache-Control "no-cache" always; try_files $uri $uri/index.html =404;
}
```

### Header inheritance rule

nginx drops every `add_header` inherited from the server level as soon as a location defines its own `add_header`.
Therefore **no header is set at server level**: `snippets/security-headers.conf` holds all security headers (below)
and **every location that sets any header includes it**, as above. `always` is used so that error responses carry
the headers too, and the `404.html` page is served from a location that includes it. A new location is not accepted
without the include; the HTTP test below enforces it.

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
| `^/(pt-br\|en-us)/support/` | `default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` |

- The support pages have **no Cloudflare analytics hosts** in their CSP and carry no beacon. `data:` is **not** allowed
  in `img-src` anywhere; an inline `<svg>` element (for example a generated QR code) is markup, not an image
  request, and is not affected.
- The Cloudflare hosts in the default policy are what the Web Analytics beacon uses to load and report; Cloudflare's
  documentation checked here does not list them, so Ensaio verifies C-5 against the real snippet and adjusts.
- The proxy layer in front of the origin adds `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin` and HSTS; nginx does not repeat them. The HTTP test below, run against the public
  URL, confirms they arrive.
- A strict CSP without `unsafe-inline` requires: no inline `<style>` or `style=""`, no inline `<script>` (JSON-LD
  `application/ld+json` blocks are data and allowed). Enforced by the Astro settings in ADR-0001 plus a post-build
  check that fails on inline executable scripts or style attributes in `dist/**/*.html`.
- Only `GET` and `HEAD`. No directory listing, no `autoindex`, no proxying, no upstream.

### Logging (D-20)

- No access log at the origin. The error log is the minimal `error` level to stdout, kept by a size-capped,
  short-rotated json-file driver (limits in [deploy](deploy.md)) and lost when the container is recreated. It can
  contain a client address when an error occurs; the Privacy text says so (site-data section 11).
- This site makes **no promise of a fixed retention period for access logs**, and no contract may state one.

### HTTP header test (required check)

Run in CI against the built image, and again against the public URL after a deploy. For each of `/pt-br/`,
`/en-us/support/`, an unknown path (status 404), a hashed file under `/_astro/`, `/data/members.json` and `/healthz`,
assert:

- `Content-Security-Policy` is present and equals the policy for that path (the support pages have no Cloudflare
  hosts), `Permissions-Policy` and `Cross-Origin-Opener-Policy` are present;
- `Cache-Control` matches the location's value;
- `/data/members.json?x=1` returns 404 and a non-GET method returns 405;
- no `Server` version string and no `Set-Cookie` anywhere;
- against the public URL: `X-Content-Type-Options`, `Referrer-Policy` and `Strict-Transport-Security` are present.

## 7. Acceptance hooks

| Id | Check |
|---|---|
| C-3 | Build script compares the page set per locale; every route key has both. |
| C-1 | Post-build scan described in section 4. |
| C-5 | Sitemap and robots lint; `hreflang` reciprocity check script over `dist/`; Web Analytics under the CSP in a browser test; the HTTP header test of section 6. |
| C-8 | Section 3 test plan, plus a browser test that the selector changes locale and survives a reload with cookies and storage disabled. |
