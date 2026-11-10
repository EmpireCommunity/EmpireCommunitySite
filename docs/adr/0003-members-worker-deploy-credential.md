# ADR-0003: Deploy credential for the member-count Worker

- Status: **Superseded** by [ADR-0004](0004-members-worker-workers-builds.md) (D-55, 2026-11-10). Kept as history. It
  was **Accepted** by the owner (D-18, 2026-11-08): GitHub Actions with a protected environment and owner approval,
  replacing the earlier recommendation (Workers Builds) after the security review of the design (T-5).
- Author: Alicerce. Task refs: T-4, T-4b. Spec: [members-json](../contracts/members-json.md), pipeline rules in
  [deploy](../contracts/deploy.md).
- Risk: High surface (deploy boundary, supply chain). The Worker holds no secret itself; the credential that can
  change it is the asset.

## Context

The Worker (one route on the production zone, one Cron Trigger, one KV binding) is deployed from the public
repository. It changes rarely (about 100 lines, a few variables). Whoever can deploy it controls what visitors'
browsers read from `/data/members.json`. Facts from the Cloudflare docs (checked 2026-11-08):

- Wrangler in CI needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Cloudflare recommends scoping the token to
  the one account and, where possible, to specific zones, and never keeping it in the repository.
- Workers Builds (Cloudflare's Git integration) creates by default a **user** token with account-wide Workers
  Scripts, KV and R2 edit and Workers Routes edit for **all zones**, and builds preview branches. Account-owned tokens
  for it are not yet available.
- The Workers Scripts permission is account-wide; it cannot be narrowed to one script.

## Options

| | Workers Builds | GitHub Actions + protected environment | Manual by owner |
|---|---|---|---|
| Credential held outside Cloudflare | none | yes, in the GitHub environment only | none |
| Token breadth | broad by default, can be trimmed | exactly what we choose | OAuth session of the owner |
| Gate before each deploy | merge to `main` | environment approval **plus** merge to `main` | the owner |
| Runs branch code with the token | preview builds unless disabled | only the workflow on `main` | no |
| Explicit OK on every deploy | no | yes | yes |

## Decision

**GitHub Actions with a protected environment and owner approval**, because every deploy then needs an explicit
approval and the token is limited to what the Worker needs. Required conditions:

1. **Workflow.** `worker-deploy.yml`, triggered by a push to `main` that touches `worker/**` or `src/data/site.yaml` (the invite is defined there and passed to the deploy, members-json 2.6), and by manual dispatch
   restricted to `main`. Never `pull_request` or `pull_request_target`. Job permissions `contents: read` only. Every
   action pinned by commit SHA. Wrangler comes from the committed lockfile (no `npx` of the latest version).
   Concurrency limited to one run.
2. **Environment** `worker-production`: deployment allowed only from `main`; required reviewer is the owner; the
   Cloudflare secrets exist **only** in this environment (no repository-level secret). **GitHub cannot restrict an
   environment to one workflow file**: environment secrets are available to any job that names the environment, once
   its protection rules pass. The **owner's approval is therefore the gate for every such job** (D-18). The owner
   approves only a run of `worker-deploy.yml` from the expected ref, after reading that workflow file as it exists at
   the commit being deployed. Repository controls make a second workflow naming the environment visible and
   blocking: workflow lint fails any workflow file other than `worker-deploy.yml` that names `worker-production`;
   `.github/workflows/`, `worker/` and `src/data/site.yaml` have the owner in `CODEOWNERS`; changes reach `main` only
   by pull request with the required checks ([deploy](../contracts/deploy.md) section 9). Where the approver and the
   person who triggered the run are the same account, the gate is procedural rather than a technical separation; this
   is accepted by the owner (D-17, D-18).
3. **Token.** Account-scoped API token, permission **Account, Workers Scripts: Edit** and nothing else by default,
   **no Zone Workers Routes: Edit**, **an expiry date** (maximum 90 days; the rotation date is recorded in the Ops
   Runbook). Further permissions are added one at a time only if a real run fails without them, and each addition is
   recorded with the reason. The minimal set is **not verified** (see below).
   **A second, read-only token** serves the post-deploy route check (item 6): **Zone, Workers Routes: Read** on the one
   zone and nothing else, with an expiry, stored as a second secret of the same environment. The Scripts token cannot
   list zone routes, so this token is created **before the first deploy** and recorded in the Ops Runbook with its
   rotation date. If the owner prefers one secret fewer, the route check is not automated: the owner reads the zone's
   route list in the dashboard after each Worker deploy, and the workflow keeps only the public checks.
4. **Wrangler configuration.** `workers_dev: false`, `preview_urls: false`, and **no `routes` or `route` key**. CI
   fails if any of these is violated (see members-json 2.1).
5. **Route.** Created once by hand in the Cloudflare dashboard by the owner or Guindaste with the owner's OK, exact
   pattern, fail open. The pipeline never creates or edits routes.
6. **Post-deploy check.** After deploying, the workflow lists the zone's Workers routes through a read-only call
   with the route-read token above (not Edit) and fails if the Worker is attached to anything other than
   the single expected pattern. It also requests the public endpoint and validates the response schema, and confirms
   the `workers.dev` address does not answer.
7. **Rotation and revocation.** Rotate at expiry or on any doubt: create the new token, replace the environment
   secret, revoke the old token. Record the date.

## Rejected

- **Workers Builds**: the automatic token is broader than the Worker needs, preview builds run branch code, and the
  merge alone would be the only gate.
- **Manual deploy by the owner**: acceptable, but a single person must be available for every change.

## Consequences

- A compromised environment secret can still change Workers on the account (the permission is account-wide). The
  mitigations are the environment gate, token expiry, no route permission, the post-deploy route check, and the
  Worker's own validation. Whether to move the Worker to its own Cloudflare account is an owner decision, not
  required now.
- The environment approval is a deliberate extra step on each Worker change (rare).

## Not verified

- The minimal token permission set (for example whether a KV or account-settings read is also needed), that the
  `Workers Routes Read` zone permission (its name is in Cloudflare's permission reference) is enough to list the
  zone's routes, and that `wrangler deploy` succeeds without any routes in its
  configuration. Confirm in the first real run and record the result in the Ops Runbook.
