# Contract: CI to host deploy path

- Version: 1. Owner: Alicerce. Consumers: Forja (workflows, Dockerfile, checks), Guindaste (host procedure, Cloudflare
  setup, runbook), Sentinela (review), Ensaio (negative tests).
- Decisions: D-10 (build in CI), D-17 (repository protection model), D-55 (the member-count Worker deploys through Workers Builds from its own repository; it supersedes D-18),
  D-20 (logging), D-24 (releases by tag, as in EmpireMuse), D-41 and D-78 (the `/discord` gate pages and their integrity rows). Operational steps: `docs/runbook/release.md`
  (Guindaste); this document holds the controls that runbook must respect. Stack: [ADR-0001](../adr/0001-stack.md). Worker deploy:
  [ADR-0004](../adr/0004-members-worker-workers-builds.md) and section 12.
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
4. **Every deploy has an explicit owner OK** (global rule). The pipeline makes that step possible, it does not replace it. The one exception in form is the Worker (section 12): it deploys on merge to its own repository's `main`, so the owner's explicit OK is given **for each merge** there.
5. **Small and boring.** Few workflows, each with the least permissions, every third-party action pinned.

## 2. Workflows

| File | Trigger | Does | Permissions | Secrets |
|---|---|---|---|---|
| `ci.yml` | `pull_request`, push to `main` | lint, typecheck, tests, image-metadata check, build, content and `dist` checks (section 4), image build and image checks, HTTP header test (including `/discord`), workflow lint, secret scan, `verify-links` (network: project URLs answer, linked repositories are public, the invite resolves; not a required check, section 9; only the step that runs the script receives the automatic read-only `github.token`, to raise the API rate limit, and no secret is used) | `contents: read` | none |
| `release.yml` | push of a tag `vX.Y.Z` (or `vX.Y.Z-rc.N`, a rehearsal) | **guards** (section 5), then build the image, push `X.Y.Z` (`X.Y.Z-rc.N` for a rehearsal) to Docker Hub with SBOM and provenance, create the attestation, create the GitHub Release with the changelog notes and `image-digest.txt`, print the digest in the run summary | `permissions: {}` at top; guards job `contents: read` and `actions: read` (it lists the CI runs of the commit); publish job adds `id-token: write`, `attestations: write` (no `packages`, nothing is published to GHCR); release job `contents: write` | `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, stored at organization level for all public projects (D-76, section 11) and read only by the login step of the publish job |
| `integrity.yml` | schedule, manual | checks the live site for invariants the release guards cannot see (section 8) | `contents: read` | none |

`release.yml` MUST NOT be reachable from a pull request or a fork. This repository has no Cloudflare credential and no workflow that deploys the Worker (section 12). If a job needs write
permission, it is a separate job with its own `permissions` block.

## 3. Workflow hygiene (all workflows)

- Every `uses:` pinned to a full commit SHA, with the version in a trailing comment; this covers step actions and job-level reusable workflows (`check-workflows` enforces both). Dependabot keeps them current,
  with **no auto-merge**, and also covers Docker and npm.
- Top-level `permissions: {}` (or `contents: read`) and explicit grants per job.
- **No `pull_request_target`**, and no workflow that runs untrusted code with secrets or a write token. No
  `workflow_run` that consumes artifacts built from a fork.
- No expression from event data (titles, branch names, commit messages, PR bodies) is interpolated into a shell step;
  pass it through an environment variable and quote it.
- `actions/checkout` with `persist-credentials: false`. `timeout-minutes` on every job. `concurrency` on `release.yml`
  (one run at a time, never cancelling a release in progress).
- Installs use the committed lockfile (`--frozen-lockfile`) from the npm registry with integrity hashes; lifecycle
  scripts only for the allowlist in ADR-0001.
- Repository settings the owner applies (depends on the owner): fork pull request workflows require approval; the
  default token is read-only; only the listed actions are allowed; the apps installed on the repository are limited to
  what is needed; strong authentication on the accounts involved.
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
  (flags today: `discordPage`, `discoveryFiles`, `legalPages`, `membersFallback`; only `legalPages` is `true`, until the
  launch PR) is listed in `scripts/lib/pending.ts` with a flag set to `true`: the check **warns** and does not fail. **The pull request that
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
neither); no pending-check flag is `true` (a rehearsal tag ignores `legalPages` and no other flag, so a release candidate can be cut before the launch PR that adds the legal texts; a final tag ignores none, `scripts/lib/pending-guard.ts`); **no image exists yet for the complete image tag** (`X.Y.Z` or
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

**Public invariants outside the release.** With release by tag, the guards, the attestation and the owner-approved deploy
cover what the repository and the image contain. They cannot see what changes **outside** them: Cloudflare settings
(HTML-rewriting features, the root redirect rules, security headers added or removed at the edge), the Worker and its
count, and the Discord invite, which can expire or be deleted. The monitor exists for those:
`integrity.yml` runs `scripts/integrity.ts`, with **Guindaste** answering its failures. The integrity rows referenced
from members-json 10.1 and routing-locale section 3 are checked here.

Runs on a schedule (every 6 hours) and on demand and reads **public URLs only**. Because production lags `main`
(a merge is not a deploy), it **does not compare the live site with `main`**: every row is an invariant of the
contract that holds for any released version. The one value taken from `main` is the Discord server id, which does not
change per release. A failing check fails the run, and GitHub's failed-run notification reaches the owner. No webhook,
token or other secret is used. Rows whose site or root target is not live yet warn only, using separate operational flags `site` and `root` in `scripts/lib/integrity-pending.ts`. The launch PR flips them to false (D-65); `check-pending` blocks a final tag while any of these values is not exactly false, without affecting prerelease tags. The live Worker rows have no deferral flag.

| Check | Rule |
|---|---|
| No payment instruction (D-28) | `/pt-br/support/` and `/en-us/support/` carry the `data-donations="not-open"` block and none of the payment-guard markers of site-data section 10 (`data-pix`, payment-provider host or short link, BR Code marker, key-shaped strings, e-mail outside the allowlist). The home page of both locales has the same payment-marker checks, without requiring a donations block (site-data section 10). |
| Rewriting features | The delivered support page has no Cloudflare e-mail obfuscation or script-rewriting markers, so a re-enabled feature is detected. |
| Discord entry (D-29, D-41, D-78) | `/pt-br/discord/` and `/en-us/discord/` each answer 200 with no `Location` header (the pages show the rules and never redirect); the one Discord invite URL on each is the same `https://discord.com/invite/<code>` URL, with or without a query string on the request; the plain-text `https://discord.com/terms` of rule 5 is allowed as text, not in an attribute (site-data section 12, Terms URL exception) and is not an invite; the pages have no script, no `<meta http-equiv="refresh">` and no other invite URL; the public invite lookup for that code returns the server id configured in `src/data/site.yaml` on `main`. The monitor does not tick the checkbox and does not check the WhatsApp link. A 429 after the permitted retry is a warning, not a failure. |
| Site-wide Discord links (D-41, D-78) | Crawl the public sitemap, up to 100 pages; no page links to a Discord invite directly: every join link points to the gate page of its locale, whose invite is checked above. |
| Root | `/?utm_source=ci` answers `302` to `/en-us/?utm_source=ci` from the (non-Brazilian) runner. The Brazilian case is checked by hand (C-8). |
| Discord redirect (D-78) | `/discord?utm_source=ci` answers `302` to `/en-us/discord/?utm_source=ci` from the (non-Brazilian) runner, and `/discord/` the same. Under the same `root` launch flag as the row above (warns before launch, blocks after). The Brazilian case is checked by hand (C-10). |
| Member count | `/data/members.json` validates against the schema, `source` is not `built-in`, and `updatedAt` is not older than 3 days or more than 5 minutes in the future. |
| Invite copies agree (members-json 2.6) | The public `wrangler.jsonc` on `main` of the Worker repository carries the same `DISCORD_GUILD_ID` as `src/data/site.yaml` on `main`; a different `DISCORD_INVITE_CODE` fails too, which is expected only between steps 2 and 3 of the rotation and clears on the next run. Reads public raw files only. The Worker is already live, so this row is blocking. |
| Headers | `/pt-br/` and `/en-us/support/` carry the expected CSP and the other headers of routing-locale section 6. `Strict-Transport-Security` MUST carry exactly one valid `max-age` greater than 0; the contract sets no longer minimum duration. |

Limits: [GitHub disables scheduled workflows after 60 days without activity in a public repository](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows); Guindaste checks the workflow remains enabled and re-enables it if needed; the monitor sees what a visitor from the
runner's network sees. Depends on the owner keeping the notifications on.

## 9. Branch and check requirements (D-17)

Applied to `main` by the owner; the list states the control, not the current settings.

- Changes reach `main` **only by pull request**; no direct push, no force push, no deletion of `main`; the rules apply
  to administrators as well.
- **Required status checks** must pass, by their fixed names in `ci.yml` (also in `docs/runbook/release.md`):
  `Quality (check, lint, tests)`, `Build and dist checks`, `Image checks and HTTP header test`, `Workflow lint` and
  `Secret scan`.
- A `CODEOWNERS` file is kept in the repository (owner for the whole tree) for future use. **No required approval
  count is specified**, because the actor and the approver may be the same account (D-17); the compensating controls
  are this document's controls: required checks, PR-only merges, the release guards and the owner-only immutable
  `v*` tags (section 5), attestation verification before deploy, the payment guard of site-data section 10, the
  integrity monitor (section 8), and the owner's approval of each deploy.

## 10. Negative tests (Ensaio)

- A pull request that adds a `traefik.*` label to the Dockerfile, or a label outside the allowed set of section 4 to
  the compose template, fails `ci.yml`. The allowed compose labels of section 4 pass.
- A fork or pull request run cannot publish an image. Fork pull request runs receive no Docker Hub secrets; organization secrets remain available to authorized workflows in public projects (D-76).
- An image built outside `release.yml` on a `vX.Y.Z` tag, or with a modified digest, fails the attestation verification.
- `release.yml` publishes nothing for: a lightweight tag, a tag whose commit is not on `main`, a commit without a green `CI` run, a missing or empty changelog section, a compose template that names another version, a pending-check flag still `true`, or a version whose image already exists.
- A push to `main` builds and publishes no image.
- A pull request that adds a payment field to `support.yaml`, sets `donations.status` to another value, or puts a payment marker in a page fails `ci.yml`.
- A payment marker in the delivered page, or a re-enabled HTML-rewriting feature, fails `integrity.yml`.
- `release.yml` does not run on a pull request or a branch push, and a pull request cannot create a `v*` tag.

## 11. Depends on the owner

Strong authentication on the GitHub, Cloudflare and host provider accounts; the organization-level `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets available to all public projects (D-76), steps in `docs/runbook/release.md`; applying and keeping the repository
settings of sections 3 and 9; the rule that only the owner creates `v*` tags and that they cannot be moved or deleted (section 5); the Workers Builds setup of ADR-0004 (connection, preview builds off, dedicated trimmed token) and its runbook checklist; keeping failed-run
notifications on; confirming the approved invite code in the pull request that sets it; the Cloudflare dashboard items copied into
the runbook (the four redirect rules R1 to R4 of routing-locale section 3, created R1 and R2 first, the `/data/` rules, the Worker route, features off); an explicit OK for each merge to the Worker repository's `main` (section 12).

D-76 accepts that these organization secrets are no longer limited to `v*` tag runs: a person with write access to
any public project in scope can read them through a branch workflow. A compromised workflow or action in any such
project can expose the shared credential, affecting every Docker Hub repository it can write to. The owner-only
`v*` tag rule, the single login-step reference in `release.yml`, and digest/attestation verification before host pulls
remain publication and deployment controls; they do not restrict organization-secret access. Keep the token least
privileged (Image Push on the intended repositories); its actual scope and the organization access policy are owner
settings to verify in the private runbook, not properties enforced by this repository.

## 12. Worker repository (D-55)

The member-count Worker is not built, deployed or checked by anything in this repository. It lives in
`EmpireCommunity/EmpireCommunitySite-Worker` (public, code only) and is deployed by Cloudflare Workers Builds on
merge to its `main` ([ADR-0004](../adr/0004-members-worker-workers-builds.md), [members-json](members-json.md)
section 6). These are the **required controls** for that repository, stated here because they are the deploy boundary:

- **Before Workers Builds is connected**: the checks below exist and are required on `main`; `CODEOWNERS` names the
  owner for the whole tree; Actions are restricted to the listed actions, pinned by commit SHA. `main` takes pull
  requests only, applies to administrators, allows no force push and requires resolved conversations.
- **Required checks** (fixed names): `Quality (lint, typecheck, tests)`; `Config check`; `Workflow lint`; `Secret scan`.
  `Config check` enforces members-json 2.1 on `wrangler.jsonc` (no `routes`, `route`, `env`, `keep_vars` or
  `triggers.routes`; `workers_dev` and `preview_urls` false; observability off; the single cron; `MEMBERS_KV`; invite
  and guild variables present and well formed) and fails on a `console.` call or an npm package import in `src/`. `Workflow lint` fails any
  workflow that references a `CLOUDFLARE_` secret or runs `wrangler deploy` (only Workers Builds deploys), uses
  `pull_request_target`, has an unpinned action, lacks `permissions: contents: read`, `persist-credentials: false` or
  `timeout-minutes`.
- **Each merge to that `main` is a production deploy** and needs the owner's explicit OK for that merge; the standing
  merge OK of D-31 covers the site repository (`EmpireCommunitySite`) only, not this one. Dependabot weekly, grouped, no auto-merge.
- **Workers Builds settings** (dashboard, outside the repository's reach, so verified by the owner at setup and by
  Guindaste monthly): production branch `main`; **Enable Preview Builds off**; no build variables; the dedicated
  build token (ADR-0004 item 6) selected; the Cloudflare GitHub app limited to the repositories that need it (this
  Worker repository and `github-worker-relay`).
- Negative tests (Ensaio): a pull request that adds a route, `keep_vars`, a second cron or `workers_dev: true` to
  `wrangler.jsonc` fails `Config check`; a workflow that references a Cloudflare secret fails `Workflow lint`; a push
  to a branch other than `main` produces no build in the Workers Builds history.
