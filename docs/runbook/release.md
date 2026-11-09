# Release and deploy runbook

Short on purpose. Contracts: [deploy](../contracts/deploy.md), [ADR-0001](../adr/0001-stack.md). Owner of this file: Guindaste.
Account and platform settings that exist today live in the private runbook, not here.

## Release (owner decides when and which version)

1. Merges collect under `[Unreleased]` in `CHANGELOG.md`. A merge to `main` never builds an image.
2. Release PR `chore/release-X.Y.Z`: move `[Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and set the tag part of the
   `image:` line in `deploy/compose.yml` to `X.Y.Z` (the digest stays a placeholder; the real one is filled on the host).
   Never straight to `main`.
3. After the merge and a green `CI` run on `main`, the owner creates an **annotated** tag on the merge commit:
   `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`. `-rc.N` tags are for a rehearsal only.
4. `release.yml` runs the guards (tag format, annotated, commit in `origin/main`, push `CI` run succeeded on that commit,
   CHANGELOG section dated and non-empty, compose names the version, image for the version does not exist), then
   builds, pushes `ghcr.io/empirecommunity/empirecommunitysite:X.Y.Z` (SBOM and provenance attached), attests the
   digest and creates the GitHub Release with the CHANGELOG notes and `image-digest.txt`. The digest is also in the
   run summary.
5. A failed guard publishes nothing: fix the cause and push a new tag name only if the old tag never produced an image.
   If the image was published but a later step failed, **do not re-run**: ship the next patch version.

## Deploy (Guindaste, only with the owner's OK for that deploy)

1. Take the digest from the release (`image-digest.txt`) or the run summary.
2. Verify before pulling (on the owner's machine if the host should not hold a GitHub credential):
   `gh attestation verify oci://ghcr.io/empirecommunity/empirecommunitysite@sha256:<digest> --repo EmpireCommunity/EmpireCommunitySite --signer-workflow EmpireCommunity/EmpireCommunitySite/.github/workflows/release.yml --source-ref refs/tags/vX.Y.Z`.
   Any failure aborts.
3. On the host: dated backup of the compose file beside it, set `image:` to `...:X.Y.Z@sha256:<digest>`,
   `docker compose up -d --wait`, then run the HTTP header test against the public URL
   (`BASE_URL=https://empirecommunity.org PUBLIC=1 node scripts/http-test.ts`) and check the site.
4. Record digest, date and approver in the private runbook.
5. **Rollback** is the previous tag@digest from the backup, same steps. A version purged under the withdrawal
   runbook (site-data 9.1) is never a rollback target.

## Checks (names are the required status checks)

`Quality (check, lint, tests)`, `Build and dist checks`, `Image checks and HTTP header test`, `Workflow lint`,
`Secret scan`. The worker configuration check joins them with the Worker (T-14).

Scans of `dist/` that wait for their page are listed in `scripts/lib/pending.ts`: they warn until the page exists.
The PR that adds the page flips its flag so the check becomes blocking.

## Traps carried over from EmpireMuse

- CHANGELOG conflicts across parallel PRs: `.gitattributes` sets the union merge driver, which only applies to merges
  run with git. GitHub's web merge ignores it, so resolve a CHANGELOG conflict by keeping both sides.
- Image, compose and env change together in one operation with one rollback.
- Keep this guide short and true: update it in the same PR as the pipeline change.
