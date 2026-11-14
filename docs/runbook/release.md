# Release and deploy runbook

Short on purpose. Contracts: [deploy](../contracts/deploy.md), [ADR-0001](../adr/0001-stack.md). Owner of this file: Guindaste.
Account and platform settings that exist today live in the private runbook, not here.

## Release (owner decides when and which version)

1. Merges collect under `[Unreleased]` in `CHANGELOG.md`. A merge to `main` never builds an image.
2. Release PR `chore/release-X.Y.Z`: move `[Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and set the tag part of the
   `image:` lines in `deploy/compose.yml` (to `X.Y.Z`) and `deploy/members-source/compose.yml` (to `X.Y.Z-members-relay`); the digests stay
   placeholders and the real ones are filled on the host. Never straight to `main`.
3. After the merge and a green `CI` run on `main`, with **no other merge in between**, the owner creates an
   **annotated** tag on that commit, which must be the tip of `main` (if another merge landed first, tag the newest
   commit or ship the next patch version):
   `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`. `-rc.N` tags are for a rehearsal only.
4. `release.yml` runs the guards (tag format, annotated, commit is the tip of `origin/main`, push `CI` run succeeded on that commit,
   CHANGELOG section dated and non-empty, both compose templates name the version, the relay `Dockerfile` and compose exist, no flag in `scripts/lib/pending.ts` is true (an `-rc.N` tag ignores `legalPages` only), neither image tag exists), then
   builds **both** images and checks both (image rules and the relay's answers) **before either is pushed**, pushes
   `docker.io/empirecommunity/empirecommunity-site-org:X.Y.Z` and `...:X.Y.Z-members-relay` (SBOM and provenance attached), attests
   each digest and creates the GitHub Release with the CHANGELOG notes, `image-digest.txt` and `relay-image-digest.txt`. The digests are also in the
   run summary.
5. A failed guard publishes nothing: fix the cause and push a new tag name only if the old tag never produced an image.
   If the image was published but a later step failed, **do not re-run**: ship the next patch version.

## Docker Hub organization secrets (D-76)

`DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` stay at organization level for all public projects, by owner decision.
The publish job reads these organization secrets directly; no `release` environment is required. Keep the
organization secrets in place after rehearsals. The tag trigger, release guards and owner-only `v*` tag rules
control publication; there is no environment gate restricting secret access to release tags.

## First publication (owner action, once)

The image goes to Docker Hub, where a public repository is anonymous-pull by default (owner rule: public projects on
Docker Hub, private ones on GHCR). `release.yml` logs in with the organization secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (above)
(names only; the values never appear in the repository, a log or a report) and does not change repository settings.

1. Before the first tag, confirm that the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` organization secrets have **write access** to
   the organization repository `empirecommunity/empirecommunity-site-org` (a member with write permission and a read-write
   token, or an organization access token with the Image Push scope, per Docker's access token docs). The repository
   already exists and is **public**. The workflow cannot check any of this.
2. After the first successful `release.yml` run (an `-rc.N` rehearsal included), verify an anonymous pull from a
   machine with no Docker Hub login before any deploy:
   `docker logout; docker pull docker.io/empirecommunity/empirecommunity-site-org@sha256:<digest>`. A failure ("denied" or
   "requested access to the resource is denied") means the repository is private or wrong: do not deploy.
3. Optional, an owner setting on Docker Hub: immutable tags for the repository. The workflow already refuses to
   publish a version whose tag exists.

### Purging an affected tag

Docker Hub does not delete immutable tags (and an image tied to one cannot be removed). Before the purge in
[site-data](../contracts/site-data.md) section 9.1, an admin of the repository opens Docker Hub, My Hub > Repositories >
`empirecommunity/empirecommunity-site-org` > Settings > General > Tag mutability settings, sets **All tags are mutable**
(or edits the regex rules so the affected tags no longer match), and saves. Then delete only the affected tags
(Tags or Image Management tab), never the repository, and restore the previous setting. Docker's docs do not say which role
may change the setting nor whether existing tags become mutable again: check a tag's state before deleting.

## Deploy (Guindaste, only with the owner's OK for that deploy)

1. Take the digest from the release (`image-digest.txt`) or the run summary. The repository must already be public
   (see First publication); the host pulls without a credential.
2. Verify before pulling (on the owner's machine if the host should not hold a GitHub credential):
   `gh attestation verify oci://docker.io/empirecommunity/empirecommunity-site-org@sha256:<digest> --repo EmpireCommunity/EmpireCommunitySite --cert-identity https://github.com/EmpireCommunity/EmpireCommunitySite/.github/workflows/release.yml@refs/tags/vX.Y.Z --cert-oidc-issuer https://token.actions.githubusercontent.com`.
   Any failure aborts.
A deploy of the member-count relay is a separate procedure with its own compose project, `relay-image-digest.txt` and the checks a to d
of `docs/contracts/deploy.md` section 13 (owner OK for each deploy); both attestations share one identity, so check the digest is the
relay's (step 3a) and not the site's.

3. On the host: dated backup of the compose file beside it, set `image:` to `...:X.Y.Z@sha256:<digest>`,
   `docker compose up -d --wait`, then run the HTTP header test against the public URL
   (`BASE_URL=https://empirecommunity.org PUBLIC=1 node scripts/http-test.ts`) and check the site.
4. Record digest, date and approver in the private runbook.
5. **Rollback** is the previous tag@digest from the backup, same steps. A version purged under the withdrawal
   runbook (site-data 9.1) is never a rollback target.

## Checks (names are the required status checks)

`Quality (check, lint, tests)`, `Build and dist checks`, `Image checks and HTTP header test`, `Workflow lint`,
`Secret scan`. `Verify external links` (`verify-links`) is **not** required: it depends on third-party sites, so a failure is read and fixed but never blocks a merge. The Worker has its own repository and checks (deploy section 12).

Scans of `dist/` that wait for their page are listed in `scripts/lib/pending.ts`: they warn until the page exists.
The PR that adds the page flips its flag so the check becomes blocking.

## Traps carried over from EmpireMuse

- CHANGELOG conflicts across parallel PRs: `.gitattributes` sets the union merge driver, which only applies to merges
  run with git. GitHub's web merge ignores it, so resolve a CHANGELOG conflict by keeping both sides.
- Image, compose and env change together in one operation with one rollback.
- Keep this guide short and true: update it in the same PR as the pipeline change.
