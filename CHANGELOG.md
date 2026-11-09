# Changelog

All notable changes to the site are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/).

Every merge adds its entry under `[Unreleased]`; a merge to `main` never builds an image. The owner decides when a
release happens and which version it gets. The release PR (`chore/release-X.Y.Z`) moves `[Unreleased]` into a dated
`## [X.Y.Z] - YYYY-MM-DD` section; `release.yml` publishes the notes from that section. See `docs/runbook/release.md`.

## [Unreleased]

### Added

- CI for the site (quality, build and `dist` checks, image and HTTP header checks, workflow lint, secret scan).
- Container image on `nginx-unprivileged` (non-root, port 8080, `/healthz`, no access log, `/data/` query blocked).
- Tag-driven release pipeline with guards, SBOM, provenance and a build provenance attestation.
- Release guard: `release.yml` fails while any flag in `scripts/lib/pending.ts` is true. `CODEOWNERS` added.
- Release guard: the tag must be the tip of `origin/main`. nginx redirects slashless locale URLs and serves `/discord` directly (200). HTTP test covers `POST /healthz`, slashless redirect and `/discord`. Workflow lint: only `worker-deploy.yml` may name `worker-production`. `dist` check for the member-count fallback (pending flag `membersFallback`).
- Deploy compose template with image `tag@sha256` and the proxy network labels.
- Site shell: violet design tokens (D-30) in `@theme`, header with the language selector, skip link and a script-free mobile menu, footer, and the `main` landmark in `BaseLayout`. A shared `NeutralLayout` gives the root chooser, the 404 and the future `/discord` page `html lang="en-US"` with the other language marked per element. Text wordmark with one swap point (`Wordmark.astro`) until the owner approves the logo. `Status` mark and the mapping from schema status values to the design names.
- Self-hosted fonts (Source Serif 4, Public Sans, variable, latin, SIL OFL 1.1) from `@fontsource-variable/*` 5.3.1 and 5.3.0, with the license texts in `public/fonts/` and `LICENSES.md`. No external font or script.
- Sitemap through `@astrojs/sitemap` 3.7.4 (MIT), locale pages only with `hreflang` pairs. `dist` checks for `html lang` and for the language selector targets.

### Fixed

- PR 6 review: the sitemap filter derives locale prefixes from `routes.ts`; `check-dist` fails on a missing 404 page and validates each language selector on its own (one link per locale, supported `hreflang`, `aria-current` only on the current link); the neutral pages get a skip link and an English-only 404 title; the mobile header and footer reflow with a larger browser font size.

### Changed

- The old green tokens are gone; the `folha-suave` token was dropped with the band it served.
