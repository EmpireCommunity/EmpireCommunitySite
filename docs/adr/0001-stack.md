# ADR-0001: Stack, serving and data modeling for the community site

- Status: Proposed. The owner approved the stack under D-10 and the member-count mechanism under D-13 (2026-11-08).
- Author: Alicerce (backend architect). Task refs: STACK-2, T-4.
- Related: [site-data](../contracts/site-data.md), [members-json](../contracts/members-json.md),
  [routing-locale](../contracts/routing-locale.md), [deploy](../contracts/deploy.md),
  [ADR-0002](0002-locale-entry-routing.md),
  [ADR-0003](0003-members-worker-deploy-credential.md).

## Context

The site is the institutional front door of EmpireCommunity: 8 routes in two locales (pt-BR and en-US, 16
pages), data driven (projects, game servers, team, Xeon goal and parts, community numbers), no forms, no accounts, no
backend (D-5). The repository is public. It ships to a shared production host behind a reverse proxy and Cloudflare, so the
runtime must be small and the pipeline must not widen the host's trust boundary. The team writes Node and Python. The sibling EmpireHubSite is not a usable reference: every source
file in it is empty and its `package.json` has no dependencies.

## Decision

### 1. Framework, language, styling

- **Astro 7.x**, `output: 'static'`, TypeScript strict, **Tailwind CSS 4.x** through `@tailwindcss/vite` (CSS-first
  tokens in `@theme`, derived from `EmpireAssets/docs/EmpireCommunity-DESIGN.md`). **No React** and no other UI
  runtime. The only browser JavaScript is a small script for the member count (see members-json) and the tiny
  progressive enhancements Vitral lists in a PR.
- Everything is a `devDependency`: the shipped artifact is static files, so no dependency reaches production at
  runtime.
- Astro config rules that other documents rely on: `trailingSlash: 'always'`, `build.format: 'directory'`,
  `build.inlineStylesheets: 'never'`, `vite.build.assetsInlineLimit: 0` (so a strict CSP without `unsafe-inline`
  works), `i18n` with `prefixDefaultLocale: true` and `redirectToDefaultLocale: false` (the default), see
  routing-locale.

### 2. Version and dependency policy

| Item | Policy |
|---|---|
| Node (build only) | **Node 24 LTS** pinned in `.nvmrc`, `engines` and the builder image. Astro 7.4.7 requires `>=22.23.4`. Node 26 became LTS on 2026-10-28; move to it no earlier than 2027-02, in its own PR. Never an odd (non-LTS) line. |
| Package manager | **pnpm**, pinned with `packageManager`, `pnpm-lock.yaml` committed, installs with `--frozen-lockfile` in CI and Docker. Lifecycle scripts only for an explicit allowlist (esbuild, sharp, Tailwind native binary). Use pnpm's minimum release age setting (3 days or more); confirm the exact name in the pnpm 12 docs when scaffolding. |
| Ranges | Caret inside the current major in `package.json`, exact versions through the lockfile. A major upgrade is its own PR with the changelog read. |
| TypeScript | `>=5 <7` until `@astrojs/check` declares support for 7 (0.9.12 declares `^5 \|\| ^6`). |
| Updates | Dependabot weekly, grouped, for npm (site and `worker/`), Docker and GitHub Actions; security updates immediately; **no auto-merge**. GitHub Actions pinned by commit SHA; both Docker images pinned by digest. The lockfile resolves only from the npm registry and keeps integrity hashes. |
| New packages | Check license and maintenance first (global rule). Prefer none: a 14-page site does not need a utility library. |
| Fonts | Self-hosted open fonts (the Co2 fonts are proprietary). No third-party font or script CDN. |

### 3. Container and serving

- Multi-stage Dockerfile: `node:24-alpine` (pinned by digest) builds `dist/`; runtime is
  `nginxinc/nginx-unprivileged:1.30-alpine-slim` (pinned tag plus digest; stable branch, about 7 MB, a few MB of RAM).
  No Node at runtime.
- **The build runs in GitHub Actions, never on the host** (D-10). CI runs lint, `astro check`, tests, build and the
  content checks in site-data. **Only a release tag `vX.Y.Z` on a commit of `main` publishes** an image `X.Y.Z` to Docker Hub (`empirecommunity/empirecommunity-site-org`, public: the owner rule is Docker Hub for public projects and GHCR for private ones; a merge to
  `main` never builds one, D-24), with a build provenance attestation; pull requests and forks never publish and never
  see a secret (the Docker Hub org secrets are read only by the publish job of the tag workflow). The host pulls **by digest**
  and verifies the attestation first; **CI holds no SSH key or any credential for the host** (pull model).
  The image must carry **no `traefik.*` label** (inherited or added), and CI fails if it does. All of this, with the
  workflow hygiene rules and the owner-approved deploy step, is specified in [deploy](../contracts/deploy.md).
- The compose file lives on the host and in the repository as a template (`deploy/`), joined to the external proxy
  network, with the routing labels from the platform runbook for `empirecommunity.org` and service port 8080. The
  member-count Worker adds no container.
- Hardening: `read_only: true`, `tmpfs` for `/tmp`, `cap_drop: [ALL]`, `no-new-privileges`, `mem_limit: 32m`,
  `pids_limit: 64`, `restart: unless-stopped`, healthcheck on `/healthz`. nginx behavior (headers, cache, errors) is
  specified in routing-locale.
- **Logging (D-20):** the site has no login or forms, so the origin keeps **no access log** (`access_log off`) and
  only a minimal error log to stdout, with a small size-capped, short-rotated json-file driver that is lost when the
  container is recreated. No contract or text for this site promises a fixed retention period for access logs; the
  Privacy page must describe this truthfully (see site-data section 11).

### 4. Content and data modeling

Full schemas are in [site-data](../contracts/site-data.md). Summary: UI strings are JSON files with one master
locale (type assertion plus test for key parity); entities (projects, game servers, team, Xeon parts) are YAML files validated by Zod through Astro content
collections, with translatable fields as `{ pt-br, en-us }` objects and everything else stated once; legal pages are
Markdown per locale with a parity check; the build fails on missing data, missing translations or missing consent.
Money is stored as integer cents. Support data (goal and parts) is read through a single module. At launch the site
receives no money and carries no payment data (D-28); donations and the transparency panel are a later contract (D-21).

### 5. Live member count

A Cloudflare Worker with a Cron Trigger (every 12 h) reads the Discord invite endpoint without a token, keeps the
last good value in KV and serves it at `/data/members.json` on the site domain; the page never shows a date and
falls back to a built-in value (D-13, D-14). EmpireBot can take over the same public contract later. Details:
[members-json](../contracts/members-json.md).

## Alternatives considered

1. **Eleventy 3.** Lighter and a good fit for data-driven static sites, but no typed schema validation of the data
   files and a weaker component model. With 16 pages built from validated data, schema validation matters more
   than build weight, and the team already aims at Astro.
2. **Hugo.** Single binary, native multilingual support, the smallest supply chain. Lost because Go templates are
   outside the team's Node and Python habits and there is no typed schema validation. It would be the choice if
   supply-chain exposure became the top priority.

Next.js, Nuxt and SvelteKit were discarded: a JavaScript runtime and constant upgrade churn for static pages.

## Consequences

- Positive: tiny runtime (static files in nginx), no secret at runtime, strict CSP possible, build failures instead of
  bad content, deploys by image digest.
- Negative: Tailwind adds a native build binary (build only) and a utility-class style the team must keep
  consistent; Astro 7 and TypeScript are moving targets, so the upgrade PRs need attention.
- The country-based root redirect and the Worker live in Cloudflare, outside the repository. Their exact
  configuration is therefore written down in the contracts and must be copied into the Ops Runbook (Guindaste).

## Open points

- Token mapping from the design record to Tailwind is Vitral's and impeccable's call, not this ADR's.
- GitHub activity as a credibility item: the source (build-time fetch of public data or a static value) is not
  decided. It is not part of the contracts yet.
- `www.empirecommunity.org` behavior is not covered (a redirect to the apex is assumed; Guindaste confirms).
