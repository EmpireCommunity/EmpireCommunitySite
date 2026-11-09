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
- Deploy compose template with image `tag@sha256` and the proxy network labels.
