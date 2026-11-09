# Changelog

All notable changes to the site are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/).

Every merge adds its entry under `[Unreleased]`; a merge to `main` never builds an image. The owner decides when a
release happens and which version it gets. The release PR (`chore/release-X.Y.Z`) moves `[Unreleased]` into a dated
`## [X.Y.Z] - YYYY-MM-DD` section; `release.yml` publishes the notes from that section. See `docs/runbook/release.md`.

## [Unreleased]

### Added

- Inner pages (T-9, T-10): Projetos (status legend, the full list with links only for what works, open source), Infraestrutura e servidores de jogos (game servers, request a game, where it runs, our own server) and Organização (how it started, the owner's text, how it works, names, official addresses as a semantic table, contact), in both locales. Founder and Team blocks render only from validated, consented `team.yaml` entries and are absent while the file is empty; an entry with a photo fails the build until photos are rendered. `getTeam` is the only read of `team.yaml`; `check-dist` now fails on a `data-person-id` without an entry or on a name or nickname outside a person block (C-4).
- Data: `projects.yaml` (EmpireMuse, github-worker-relay, EmpireCommunitySite live; EmpireHub, EmpireBot, EmpireCraft in development, from the verified catalog) and `game-servers.yaml` (Minecraft live; Palworld, Project Zomboid, Factorio coming soon), which also switches on the Home sections for them. Live servers sort first, then by name. `site.yaml` gains `links.contributing` (the organization's contribution guide), linked from Projetos.
- Ruled lines: the name column is 14 rem and breaks long names instead of overlapping the description; a row with a status reserves the links column only when it asks for it (`linksColumn`); a full-width list can use a wider name column. Home project rows no longer carry the site link (it is on Projetos).
- Brand swap (T-3f, D-40, D-42): `Wordmark.astro` now inlines the approved Rack lockup (`src/assets/brand/lockup-header.svg`, 242 x 28, `currentColor` ink, accessible name on the SVG; 22 px high below 376 px, replacing the 20 px text rule). Favicon set in `public/` (`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) linked from both layouts through `BrandHead.astro`, and `og-image.png` (1200 x 630) as the default Open Graph image, on locale and neutral pages alike (the root chooser, the 404 and /discord keep their own `noindex` rules). Static images only: the Discord GIFs are not on the site (WCAG 2.2.2). `check-dist` fails when one of those files is not built.
- CI for the site (quality, build and `dist` checks, image and HTTP header checks, workflow lint, secret scan).
- Container image on `nginx-unprivileged` (non-root, port 8080, `/healthz`, no access log, `/data/` query blocked).
- Tag-driven release pipeline with guards, SBOM, provenance and a build provenance attestation.
- Release guard: `release.yml` fails while any flag in `scripts/lib/pending.ts` is true. `CODEOWNERS` added.
- Release guard: the tag must be the tip of `origin/main`. nginx redirects slashless locale URLs and serves `/discord` directly (200). HTTP test covers `POST /healthz`, slashless redirect and `/discord`. Workflow lint: only `worker-deploy.yml` may name `worker-production`. `dist` check for the member-count fallback (pending flag `membersFallback`).
- Deploy compose template with image `tag@sha256` and the proxy network labels.
- Site shell: violet design tokens (D-30) in `@theme`, header with the language selector, skip link and a script-free mobile menu, footer, and the `main` landmark in `BaseLayout`. A shared `NeutralLayout` gives the root chooser, the 404 and the future `/discord` page `html lang="en-US"` with the other language marked per element. Text wordmark with one swap point (`Wordmark.astro`) until the owner approves the logo. `Status` mark and the mapping from schema status values to the design names.
- Self-hosted fonts (Source Serif 4, Public Sans, variable, latin, SIL OFL 1.1) from `@fontsource-variable/*` 5.3.1 and 5.3.0, with the license texts in `public/fonts/` and `LICENSES.md`. No external font or script.
- Sitemap through `@astrojs/sitemap` 3.7.4 (MIT), locale pages only with `hreflang` pairs. `dist` checks for `html lang` and for the language selector targets.
- Home and Como participar pages (T-8): hero, numbers strip, purpose, what we do, funding and join sections; the projects and game-server sections appear when `projects.yaml` and `game-servers.yaml` have entries. Join page with one channel block per channel of the locale, a "what you can do" list and a native `<details>` FAQ. Every channel button and footer link goes to `/discord` (R-5, D-41).
- Components: channel button and pair, ruled line, Índice with A Margem (draws once on the Home), numbers strip, FAQ item, arrow link, icons (Lucide ISC, Simple Icons CC0, recorded in `LICENSES.md`).
- Member count: shared display rule (`src/lib/members.ts`) and an external script that swaps the built-in Discord value for `/data/members.json` and does nothing on any failure.
- Data: `community.yaml` (founded 2022, purpose, WhatsApp 60 members), `join-channels.yaml` (Discord, WhatsApp pt-BR only), `site.yaml` `discord.inviteCode` and `discord.guildId`, with the schema for them.
- `dist` checks: the WhatsApp community link may appear only on the `/discord` page; legal pages are scanned for WhatsApp on their `<main>` (the pt-BR footer lists the channel).

- Origin fallback `dist/data/members.json` generated by the build from `community.yaml` (`source: built-in`); `PENDING.membersFallback` is now false. `discord.membersBuiltIn` is 888 (verified reading from the approved invite on 2026-11-09) and required again in the schema; the numbers strip shows the Discord figure on both locales and the WhatsApp figure in pt-BR.
- Como participar: "what you can do" rows link to game servers, GitHub and Support.

### Fixed

- PR 6 review: the sitemap filter derives locale prefixes from `routes.ts`; `check-dist` fails on a missing 404 page and validates each language selector on its own (one link per locale, supported `hreflang`, `aria-current` only on the current link); the neutral pages get a skip link and an English-only 404 title; the mobile header and footer reflow with a larger browser font size.

### Changed

- The old green tokens are gone; the `folha-suave` token was dropped with the band it served.
