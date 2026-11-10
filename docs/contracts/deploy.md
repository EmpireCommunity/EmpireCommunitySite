# Contract: CI to host deploy path

- Version: 1. Owner: Alicerce. Consumers: Forja (workflows, Dockerfile, checks), Guindaste (host procedure, Cloudflare
  setup, runbook), Sentinela (review), Ensaio (negative tests).
- Decisions: D-10 (build in CI), D-17 (repository protection model), D-18 (Worker deploy through GitHub Actions with
  owner approval), D-20 (logging), D-24 (releases by tag, as in EmpireMuse), D-41 (the `/discord` page and its integrity row). Operational steps: `docs/runbook/release.md`
  (Guindaste); this document holds the controls that runbook must respect. Stack: [ADR-0001](../adr/0001-stack.md). Worker credential:
  [ADR-0003](../adr/0003-members-worker-deploy-credential.md).
- This repository is public. The document states **required controls only**. Account and platform settings that exist
  today are not described here; the owner and Guindaste keep them in the private runbook.
- Keywords MUST, SHOULD, MAY are used as in RFC 2119.

## 1. Principles

1. **Pull model.** CI builds and publishes an artifact; the host pulls it. CI has no credential for the host: no SSH
   key, no deploy key, no token, no inbound access. Nothing in GitHub can start or change anything on the host.
2. **Publish only from a release tag (D-24).** A merge to `main` never builds an image. Only a pushed tag `vX.Y.Z`
   whose commit is on `main` publishes, through `release.yml`. Pull requests, forks and every other ref never publish
   and never see a secret.
3. **Verify before pull, deploy by digest.** The host deploys an image identified by digest, and only after verifying
   its build provenance attestation.
4. **Every deploy has an explicit owner OK** (global rule). The pipeline makes that step possible, it does not replace it.
5. **Small and boring.** Few workflows, each with the least permissions, every third-party action pinned.

## 2. Workflows

| File | Trigger | Does | Permissions | Secrets |
|---|---|---|---|---|
| `ci.yml` | `pull_request`, push to `main` | lint, typecheck, tests, build, content and `dist` checks (section 4), image build and image checks, HTTP header test, worker config check (arrives with the Worker, T-14), workflow lint, secret scan | `contents: read` | none |
| `release.yml` | push of a tag `vX.Y.Z` (or `vX.Y.Z-rc.N`, a rehearsal) | **guards** (section 5), then build the image, push `X.Y.Z` (`X.Y.Z-rc.N` for a rehearsal) to Docker Hub with SBOM and provenance, create the attestation, create the GitHub Release with the changelog notes and `image-digest.txt`, print the digest in the run summary | `permissions: {}` at top; guards job `contents: read`; publish job adds `id-token: write`, `attestations: write` (no `packages`, nothing is published to GHCR); release job `contents: write` | `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (org secrets), read only by the login step of the publish job |
| `worker-deploy.yml` | push to `main` touching `worker/**` or `src/data/site.yaml` (the invite, members-json 2.6), manual dispatch from `main` | deploys the Worker behind the protected environment | per ADR-0003 | environment secrets only |
| `integrity.yml` | schedule, manual | checks the live site for invariants the release guards cannot see (section 8); not written yet | `contents: read` | none |

`release.yml` and `worker-deploy.yml` MUST NOT be reachable from a pull request or a fork. If a job needs write
permission, it is a separate job with its own `permissions` block.

## 3. Workflow hygiene (all workflows)

- Every `uses:` pinned to a full commit SHA, with the version in a trailing comment. Dependabot keeps them current,
  with **no auto-merge**, and also covers `worker/`, Docker and npm.
- Top-level `permissions: {}` (or `contents: read`) and explicit grants per job.
- **No `pull_request_target`**, and no workflow that runs untrusted code with secrets or a write token. No
  `workflow_run` that consumes artifacts built from a fork.
- No expression from event data (titles, branch names, commit messages, PR bodies) is interpolated into a shell step;
  pass it through an environment variable and quote it.
- `actions/checkout` with `persist-credentials: false`. `timeout-minutes` on every job. `concurrency` on `release.yml`
  and `worker-deploy.yml` (one run at a time, never cancelling a release in progress).
- Installs use the committed lockfile (`--frozen-lockfile`) from the npm registry with integrity hashes; lifecycle
  scripts only for the allowlist in ADR-0001.
- Repository settings the owner applies (depends on the owner): fork pull request workflows require approval; the
  default token is read-only; only the listed actions are allowed; the apps installed on the repository are limited to
  what is needed; strong authentication on the accounts involved.
- **The environment `worker-production` is named by `worker-deploy.yml` only.** GitHub cannot restrict an environment
  to one workflow file, so workflow lint fails any other workflow file that contains `environment:` with that name;
  together with the owner's approval of every such job this is the control (ADR-0003).
- `.maestri/`, local worktrees, `.git/`, `.github/`, environment files and `node_modules/` are excluded by
  `.dockerignore` (and `.maestri/` and worktrees by `.gitignore`), so the image build context never includes them. The
  context otherwise holds what the build stage needs (sources, lockfile, scripts, nginx configuration); the **runtime
  image** is limited to `dist/` and the nginx configuration (section 4).

## 4. Image rules (checked by `ci.yml`, CI fails on any violation)

- **No `traefik.*` label** on the image: the check inspects the built image's labels (and the base images') and fails
  if any key starts with `traefik.`. The Dockerfile has no `LABEL` with that prefix. Routing labels exist **only** in
  the compose template (below), never in an image, so an inherited label cannot route another host name.
- **Compose template validation.** `deploy/compose.yml` is the template for the host. CI parses it and fails unless
  the `image` line has the form `docker.io/empirecommunity/empirecommunity-site-org:X.Y.Z@sha256:<64 hex>` (the digest in the
  repository is a **placeholder that is never deployed**) and the only `traefik.*` keys are `traefik.enable`,
  `traefik.docker.network`, one router rule that is exactly ``Host(`empirecommunity.org`)`` (the host name in backticks, as Traefik's rule
  syntax requires), and one service port (8080).
- **Checks for pages that do not exist yet only warn.** A scan whose target page or file is not in the scaffold yet
  (today: the `/discord` page, the `data-donations` block on the support pages, the discovery files) is listed in
  `scripts/lib/pending.ts` with a flag set to `true`: the check **warns** and does not fail. **The pull request that
  adds the page sets its flag to `false` in the same change**, which makes the check blocking from then on. A reviewer
  rejects a page-adding PR that leaves its flag `true`, and the flag list is empty before the first release
  (`release.yml` MUST fail if any flag is still `true`).
- Both base images pinned by digest. `dist/` is built and checked in the build stage of the image, so the files that
  ship are the files that were checked. The runtime image contains `dist/` and the nginx configuration only: no `src/`,
  no **source** data files (YAML) and no Node. The generated member-count fallback `dist/data/members.json`
  (members-json section 4) **is** part of `dist/` and ships; the image check rejects source or data files by type
  (YAML, TypeScript, Astro), not generated JSON. The image runs as a non-root user, exposes only 8080, and declares no
  `VOLUME`.
- The built image is started in CI and the HTTP header test of routing-locale section 6 runs against it.

## 5. Release, publication and attestation (D-24)

**Release PR.** `chore/release-X.Y.Z` moves `[Unreleased]` in `CHANGELOG.md` to a dated `## [X.Y.Z]` section and changes
**only the tag part** of the `image:` line in `deploy/compose.yml` to `X.Y.Z`. The digest stays the placeholder: it
does not exist before the image is built, and **the real digest is filled on the host at deploy** (section 6). The
release PR goes through the same required checks as any PR (section 9).

**Tag.** After the merge and a green `CI` run on that commit of `main` (with no other merge in between), the owner
creates an **annotated** tag `vX.Y.Z` on it. Only the owner creates `v*` tags, and `v*` tags cannot be moved or deleted once pushed (a repository
rule the owner applies, section 11). `-rc.N` tags are a rehearsal: they publish a pre-release under their **own image tag** `X.Y.Z-rc.N`, so they never
occupy the `X.Y.Z` tag of the final release, and they are never deployed.

**Guards** (job 1 of `release.yml`; any failure publishes nothing): tag matches `vX.Y.Z` (or `-rc.N`); the tag is
annotated; its commit **is the tip of `origin/main`**; the push `CI` run on that commit succeeded; for a final release,
the changelog has a dated, non-empty `[X.Y.Z]` section and the compose template names `X.Y.Z` (a rehearsal reads
neither); no pending-check flag is `true`; **no image exists yet for the complete image tag** (`X.Y.Z` or
`X.Y.Z-rc.N`), so a version is published once and is immutable. Why the tip and not just "contained in `main`":
releases are cut only from the newest commit, so every release contains every removal merged before it, with no
register of affected commits (which would itself need the removed data to be identified) and no extra step for the
owner; the cost is that a merge between the release merge and the tag requires the next patch version. After a
withdrawal ([site-data](site-data.md) 9.1) images already published with the data are purged, and a purged version is
never a rollback or deploy target. If the image was published and a later
step fails, the run is not repeated: the next patch version ships.

**Publication.** Owner rule: a public project publishes on Docker Hub, a private one on GHCR. This repository is public (D-45), so the image is `docker.io/empirecommunity/empirecommunity-site-org:X.Y.Z` (`:X.Y.Z-rc.N` for a rehearsal). **No mutable tag (`latest`, a
branch name or a commit tag) is used for deployment**; the deploy reference is the digest in `image-digest.txt` of
the GitHub Release and in the run summary. The job attaches SBOM and provenance and creates a build provenance
attestation for that digest with the official GitHub attestation action (pinned by SHA), with `subject-name` `docker.io/empirecommunity/empirecommunity-site-org` (the form GitHub's docs require for Docker Hub) and the attestation also pushed to the registry. The verification in section 6 reads GitHub's attestation store by digest.

**Identity.** The attestation of a valid release has the identity
`https://github.com/EmpireCommunity/EmpireCommunitySite/.github/workflows/release.yml@refs/tags/vX.Y.Z`. An image built
from another ref or workflow, a push to `main`, or a different tag has no attestation with that identity and is not
deployable by the procedure below.

## 6. Host procedure (owner OK required for each deploy)

1. Take the digest from the release (`image-digest.txt`) or the `release.yml` run summary for the tag.
2. **Verify the attestation before pulling**, for example
   `gh attestation verify oci://docker.io/empirecommunity/empirecommunity-site-org@sha256:<digest> --repo EmpireCommunity/EmpireCommunitySite --cert-identity https://github.com/EmpireCommunity/EmpireCommunitySite/.github/workflows/release.yml@refs/tags/vX.Y.Z --cert-oidc-issuer https://token.actions.githubusercontent.com`
   (the runbook's `--signer-workflow` plus `--source-ref refs/tags/vX.Y.Z` form is equivalent). Any failure aborts the
   deploy. The identity pins the workflow **and** the tag. Whether the verifying tool needs a read-only token on the
   host is **not verified**; if it does, verify on the owner's machine and carry only the verified digest, so the
   host stores no GitHub credential.
3. Only then, on the host, keep a dated backup of the compose file, set the `image:` line to
   `...:X.Y.Z@sha256:<digest>` (the **digest is filled here**, not in the repository), pull and start.
4. Check the public site with the HTTP header test (`BASE_URL=https://empirecommunity.org PUBLIC=1`) and, once it
   exists, the integrity check of section 8.
5. Record in the runbook (private): version, digest, date, who approved. **Rollback** is the previous verified
   tag and digest from the backup; a version purged under the withdrawal runbook (site-data 9.1) is never a rollback
   target.

## 7. Host compose requirements

Joined only to the external proxy network; no published ports; no docker socket; no bind mounts; no environment
secrets (the site has none). `read_only: true`, `tmpfs` for `/tmp`, `cap_drop: [ALL]`, `no-new-privileges`,
`mem_limit: 32m`, `pids_limit: 64`, healthcheck on `/healthz`, `restart: unless-stopped`.

**Logging (D-20):** json-file driver with `max-size: 1m` and `max-file: 2`, so the minimal error log is short-lived and
disappears when the container is recreated. The origin writes no access log. No contract for this site promises a
fixed retention period for access logs.

## 8. Integrity monitor (`integrity.yml`, secret-free)

**Still needed, in a smaller form.** With release by tag, the guards, the attestation and the owner-approved deploy
cover what the repository and the image contain. They cannot see what changes **outside** them: Cloudflare settings
(HTML-rewriting features, the root redirect rules, security headers added or removed at the edge), the Worker and its
count, and the Discord invite, which can expire or be deleted. The monitor exists for those. It is **not written yet**:
it is a small separate task for **Forja** (the workflow), with **Guindaste** answering its failures; Regente assigns
the ref. If it is not wanted, the controls above stay valid but those outside changes go undetected, and the
integrity rows referenced from other contracts (members-json 10.1, routing-locale section 3) lose their detector.

Runs on a schedule (every 6 hours) and on demand and reads **public URLs only**. Because production lags `main`
(a merge is not a deploy), it **does not compare the live site with `main`**: every row is an invariant of the
contract that holds for any released version. The one value taken from `main` is the Discord server id, which does not
change per release. A failing check fails the run, and GitHub's failed-run notification reaches the owner. No webhook,
token or other secret is used. Rows whose target is not live yet (member count until the Worker is deployed in T-14,
root until the Cloudflare rules exist) warn only, through the same flag mechanism as section 4.

| Check | Rule |
|---|---|
| No payment instruction (D-28) | `/pt-br/support/` and `/en-us/support/` carry the `data-donations="not-open"` block and none of the payment-guard markers of site-data section 10 (`data-pix`, payment-provider host or short link, BR Code marker, key-shaped strings, e-mail outside the allowlist), and the same holds for the home page of both locales. |
| Rewriting features | The delivered support page has no Cloudflare e-mail obfuscation or script-rewriting markers, so a re-enabled feature is detected. |
| Discord entry (D-29, D-41) | `/discord` answers 200 with no `Location` header (the page shows the rules and never redirects); every Discord invite URL on it, one per language container, is the same `https://discord.com/invite/<code>` URL, with or without a query string on the request; the plain-text `https://discord.com/terms` of rule 5 is allowed as text, not in an attribute (site-data section 12, Terms URL exception) and is not an invite; the page has no script, no `<meta http-equiv="refresh">` and no other invite URL; the public invite lookup for that code returns the server id configured in `src/data/site.yaml` on `main`. The monitor does not tick the checkbox and does not check the WhatsApp link. |
| Root | `/?utm_source=ci` answers `302` to `/en-us/?utm_source=ci` from the (non-Brazilian) runner. The Brazilian case is checked by hand (C-8). |
| Member count | `/data/members.json` validates against the schema, `source` is not `built-in`, and `updatedAt` is not older than 3 days. |
| Headers | `/pt-br/` and `/en-us/support/` carry the expected CSP and the other headers of routing-locale section 6. |

Limits: GitHub may disable scheduled workflows of a public repository after a long period without repository
activity (verify in GitHub's documentation and re-enable if it happens); the monitor sees what a visitor from the
runner's network sees. Depends on the owner keeping the notifications on.

## 9. Branch and check requirements (D-17)

Applied to `main` by the owner; the list states the control, not the current settings.

- Changes reach `main` **only by pull request**; no direct push, no force push, no deletion of `main`; the rules apply
  to administrators as well.
- **Required status checks** must pass: quality (lint, typecheck, tests); build with content and `dist` checks; image
  checks and HTTP header test; workflow lint and secret scan; and the worker configuration check once the Worker
  exists (T-14). The check names are fixed in `ci.yml` and listed in `docs/runbook/release.md`.
- A `CODEOWNERS` file is kept in the repository (owner for the whole tree) for future use. **No required approval
  count is specified**, because the actor and the approver may be the same account (D-17); the compensating controls
  are this document's controls: required checks, PR-only merges, the release guards and the owner-only immutable
  `v*` tags (section 5), attestation verification before deploy, the payment guard of site-data section 10, the
  integrity monitor (section 8) once written, and the owner's approval of each deploy.

## 10. Negative tests (Ensaio)

- A pull request that adds a `traefik.*` label to the Dockerfile, or a label outside the allowed set of section 4 to
  the compose template, fails `ci.yml`. The allowed compose labels of section 4 pass.
- A workflow file other than `worker-deploy.yml` that names the environment `worker-production` fails `ci.yml`.
- A fork or pull request run cannot publish an image, cannot read an environment secret and cannot trigger
  `worker-deploy.yml`.
- An image built outside `release.yml` on a `vX.Y.Z` tag, or with a modified digest, fails the attestation verification.
- `release.yml` publishes nothing for: a lightweight tag, a tag whose commit is not on `main`, a commit without a green `CI` run, a missing or empty changelog section, a compose template that names another version, a pending-check flag still `true`, or a version whose image already exists.
- A push to `main` builds and publishes no image.
- A pull request that adds a payment field to `support.yaml`, sets `donations.status` to another value, or puts a payment marker in a page fails `ci.yml`.
- A payment marker in the delivered page, or a re-enabled HTML-rewriting feature, fails `integrity.yml`.
- `release.yml` does not run on a pull request or a branch push, and a pull request cannot create a `v*` tag.

## 11. Depends on the owner

Strong authentication on the GitHub, Cloudflare and host provider accounts; applying and keeping the repository
settings of sections 3 and 9; the rule that only the owner creates `v*` tags and that they cannot be moved or deleted (section 5); the protected environment and the two expiring tokens (ADR-0003); keeping failed-run
notifications on; confirming the approved invite code in the pull request that sets it; the Cloudflare dashboard items copied into
the runbook (the two root redirect rules, the `/data/` rules, the Worker route, features off). `/discord` needs no
dashboard item (D-29).
