# Contract: CI to host deploy path

- Version: 1. Owner: Alicerce. Consumers: Forja (workflows, Dockerfile, checks), Guindaste (host procedure, Cloudflare
  setup, runbook), Sentinela (review), Ensaio (negative tests).
- Decisions: D-10 (build in CI), D-17 (repository protection model), D-18 (Worker deploy through GitHub Actions with
  owner approval), D-20 (logging). Stack: [ADR-0001](../adr/0001-stack.md). Worker credential:
  [ADR-0003](../adr/0003-members-worker-deploy-credential.md).
- This repository is public. The document states **required controls only**. Account and platform settings that exist
  today are not described here; the owner and Guindaste keep them in the private runbook.
- Keywords MUST, SHOULD, MAY are used as in RFC 2119.

## 1. Principles

1. **Pull model.** CI builds and publishes an artifact; the host pulls it. CI has no credential for the host: no SSH
   key, no deploy key, no token, no inbound access. Nothing in GitHub can start or change anything on the host.
2. **Publish only from `main`.** Only a push to `main` publishes an image. Pull requests, forks and manual runs from
   other refs never publish and never see a secret.
3. **Verify before pull, deploy by digest.** The host deploys an image identified by digest, and only after verifying
   its build provenance attestation.
4. **Every deploy has an explicit owner OK** (global rule). The pipeline makes that step possible, it does not replace it.
5. **Small and boring.** Few workflows, each with the least permissions, every third-party action pinned.

## 2. Workflows

| File | Trigger | Does | Permissions | Secrets |
|---|---|---|---|---|
| `ci.yml` | `pull_request`, push to `main` | lint, typecheck, tests, build, content and `dist` checks, image build and image checks, HTTP header test, worker config check, workflow lint, secret scan | `contents: read` | none |
| `publish.yml` | push to `main` only | build the image, push to GHCR, create the provenance attestation, print the digest in the run summary | `contents: read`, and only in the publish job `packages: write`, `id-token: write`, `attestations: write` | none (uses the run's token) |
| `worker-deploy.yml` | push to `main` touching `worker/**`, manual dispatch from `main` | deploys the Worker behind the protected environment | per ADR-0003 | environment secrets only |
| `integrity.yml` | schedule, manual | checks the live site against the repository (section 8) | `contents: read` | none |

`publish.yml` and `worker-deploy.yml` MUST NOT be reachable from a pull request or a fork. If a job needs write
permission, it is a separate job with its own `permissions` block.

## 3. Workflow hygiene (all workflows)

- Every `uses:` pinned to a full commit SHA, with the version in a trailing comment. Dependabot keeps them current,
  with **no auto-merge**, and also covers `worker/`, Docker and npm.
- Top-level `permissions: {}` (or `contents: read`) and explicit grants per job.
- **No `pull_request_target`**, and no workflow that runs untrusted code with secrets or a write token. No
  `workflow_run` that consumes artifacts built from a fork.
- No expression from event data (titles, branch names, commit messages, PR bodies) is interpolated into a shell step;
  pass it through an environment variable and quote it.
- `actions/checkout` with `persist-credentials: false`. `timeout-minutes` on every job. `concurrency` on `publish.yml`
  and `worker-deploy.yml` (one run at a time).
- Installs use the committed lockfile (`--frozen-lockfile`) from the npm registry with integrity hashes; lifecycle
  scripts only for the allowlist in ADR-0001.
- Repository settings the owner applies (depends on the owner): fork pull request workflows require approval; the
  default token is read-only; only the listed actions are allowed; the apps installed on the repository are limited to
  what is needed; strong authentication on the accounts involved.
- `.maestri/` (agent workspace data) is in `.gitignore` and `.dockerignore`; the image build context never includes it
  or any file outside `dist/` and the nginx configuration.

## 4. Image rules (checked by `ci.yml`, CI fails on any violation)

- **No `traefik.*` label** on the image: the check inspects the built image's labels (and the base images') and fails
  if any key starts with `traefik.`. The Dockerfile has no `LABEL` with that prefix. Routing labels exist **only** in
  the compose template (below), never in an image, so an inherited label cannot route another host name.
- **Compose template validation.** `deploy/compose.yml` is the template for the host. CI parses it and fails unless
  the only `traefik.*` keys are `traefik.enable`, `traefik.docker.network`, one router rule that is exactly
  `Host(empirecommunity.org)`, and one service port (8080).
- Both base images pinned by digest. The runtime image contains `dist/` and the nginx configuration only, no `src/`,
  no data files, no Node. It runs as a non-root user, exposes only 8080, and declares no `VOLUME`.
- The built image is started in CI and the HTTP header test of routing-locale section 6 runs against it.

## 5. Publication and attestation

- `publish.yml` pushes `ghcr.io/empirecommunity/empirecommunitysite:sha-<commit>`. **No mutable tag (`latest`) is used
  for deployment.** The deploy reference is always the digest printed in the run summary.
- The job creates a build provenance attestation for that digest with the official GitHub attestation action (pinned by
  SHA) and pushes it with the image.
- An image built from any other ref, or by any other workflow, has no valid attestation for `publish.yml` on `main`
  and is therefore not deployable by the procedure below.

## 6. Host procedure (owner OK required for each run)

1. Take the digest from the `publish.yml` run summary on `main`.
2. **Verify the attestation before pulling**, for example
   `gh attestation verify oci://ghcr.io/empirecommunity/empirecommunitysite@sha256:<digest> --repo EmpireCommunity/EmpireCommunitySite --cert-identity https://github.com/EmpireCommunity/EmpireCommunitySite/.github/workflows/publish.yml@refs/heads/main --cert-oidc-issuer https://token.actions.githubusercontent.com`.
   Any failure aborts the deploy. The identity pins the workflow **and** the `main` ref. Whether the verifying tool
   needs a read-only token on the host is **not verified**; if it does, verify on the owner's machine and carry only
   the verified digest, so the host stores no GitHub credential.
3. Only then set the `image:` line of the compose file to `...@sha256:<digest>`, pull and start.
4. Check the public site with the HTTP header test and the integrity check of section 8.
5. Record in the runbook (private): digest, date, who approved. **Rollback** is the previous verified digest; a version
   purged under the withdrawal runbook (site-data 9.1) is never a rollback target.

## 7. Host compose requirements

Joined only to the external proxy network; no published ports; no docker socket; no bind mounts; no environment
secrets (the site has none). `read_only: true`, `tmpfs` for `/tmp`, `cap_drop: [ALL]`, `no-new-privileges`,
`mem_limit: 32m`, `pids_limit: 64`, healthcheck on `/healthz`, `restart: unless-stopped`.

**Logging (D-20):** json-file driver with `max-size: 1m` and `max-file: 2`, so the minimal error log is short-lived and
disappears when the container is recreated. The origin writes no access log. No contract for this site promises a
fixed retention period for access logs.

## 8. Integrity monitor (`integrity.yml`, secret-free)

Runs on a schedule (every 6 hours) and on demand, reads **public URLs only**, and uses the checked-out `main` as the
reference. A failing check fails the run, and GitHub's failed-run notification reaches the owner. No webhook, token or
other secret is used.

| Check | Rule |
|---|---|
| Payment key | The `data-pix` block of `/pt-br/support/` and `/en-us/support/` equals the key and recipient in `src/data/support.yaml` on `main`; if the file has no key, the pages have none; the key appears nowhere else on the page. |
| Rewriting features | The delivered support page has no Cloudflare e-mail obfuscation or script-rewriting markers, so a re-enabled feature is detected. |
| Discord entry | `/discord` answers with a redirect whose target is the invite configured in `worker/wrangler.jsonc`, and the public invite lookup for that code returns the configured guild id. |
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
  checks and HTTP header test; worker configuration check; workflow lint and secret scan. The check names are
  fixed by Forja in `ci.yml` and listed in the runbook.
- A `CODEOWNERS` file is kept in the repository (owner for the whole tree) for future use. **No required approval
  count is specified**, because the actor and the approver may be the same account (D-17); the compensating controls
  are this document's controls: required checks, PR-only merges, the integrity monitor, attestation verification
  before deploy, the Pix key pinned on the official Discord, and the owner's approval of each deploy.

## 10. Negative tests (Ensaio)

- A pull request that adds a `traefik.*` label to the Dockerfile or the compose template fails `ci.yml`.
- A fork or pull request run cannot publish an image, cannot read an environment secret and cannot trigger
  `worker-deploy.yml`.
- An image built outside `publish.yml` on `main`, or with a modified digest, fails the attestation verification.
- A changed Pix key in the delivered page, or a re-enabled HTML-rewriting feature, fails `integrity.yml`.
- `publish.yml` does not run on a pull request.

## 11. Depends on the owner

Strong authentication on the GitHub, Cloudflare and host provider accounts; applying and keeping the repository
settings of sections 3 and 9; the protected environment and the expiring token (ADR-0003); keeping failed-run
notifications on; the Cloudflare dashboard items copied into the runbook (root redirect, `/discord`, the `/data/`
rules, features off).
