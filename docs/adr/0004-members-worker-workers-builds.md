# ADR-0004: The member-count Worker deploys through Workers Builds from its own repository

- Status: **Accepted** by the owner (D-55, 2026-11-10). **Supersedes** [ADR-0003](0003-members-worker-deploy-credential.md)
  (GitHub Actions with a protected environment, D-18).
- Author: Alicerce. Task ref: T-14a. Specs: [members-json](../contracts/members-json.md), [deploy](../contracts/deploy.md)
  section 12.
- Risk: High surface (deploy boundary, supply chain). The Worker holds no secret; the credential that can change it is
  the asset.

## Context

The owner wants the Worker in its own public repository, `EmpireCommunity/EmpireCommunitySite-Worker`, imported into
Cloudflare and deployed on merge to `main`, the way `github-worker-relay` is. Whoever can deploy it controls the one
integer that visitors' browsers read from `/data/members.json`.

Facts from the Cloudflare documentation, read on 2026-11-10 (all under `https://developers.cloudflare.com/`):

- **Default build token** (`workers/ci-cd/builds/configuration/`): created automatically on the account, with Account
  Settings (read), Workers Scripts (edit), Workers KV Storage (edit), Workers R2 Storage (edit), **Workers Routes
  (edit) for all zones**, and User Details and Memberships (read). "Currently, only user tokens are supported, with
  account-owned token support coming soon." The page also says one can "create your own API token, or select one that
  you already own" in the build settings. The Builds API page (`workers/ci-cd/builds/api-reference/`) repeats that
  user-scoped tokens are required.
- **Branch builds** (`workers/ci-cd/builds/build-branches/`): the checkbox **Enable Preview Builds**, under Settings,
  Build, Branch control. When on, "every push to a branch that is not your production branch triggers a preview
  build". The production branch is chosen in the same place (default: the repository's default branch). The Builds API
  has `previews_enabled`, which can be set to `false`.
- **Variables** (`workers/ci-cd/builds/configuration/`): build variables and secrets are "accessible only to your
  build" and "will not be accessible at runtime"; runtime variables are set elsewhere in the Worker settings.
- **Wrangler** (`workers/wrangler/configuration/`, section Source of truth): Wrangler overrides routes and dashboard
  variables on the next deploy; "To manage routes via the Cloudflare dashboard only, remove any route and routes keys
  from your Wrangler configuration file. Then add `workers_dev = false`." `keep_vars` stops the variable override.
  `workers_dev` may be `false` for a Worker that is only for scheduled events. If `preview_urls` is omitted Wrangler
  leaves an existing setting alone, so it is set explicitly. The Worker name in the dashboard must equal `name` in the
  Wrangler configuration or the build fails (`workers/ci-cd/builds/`).

## Decision

1. **Own repository, Worker code only.** Nothing from the site lives there and nothing of the Worker lives in the site
   repository. The repository is public (no secret in code).
2. **Workers Builds on merge to `main`.** Production branch `main`; **Enable Preview Builds is off**, so no branch
   other than `main` is built; no build variables or secrets are defined (the Worker has none). **Supply chain of the
   build** (the build token is present while dependency install scripts run): install from the committed lockfile
   with integrity hashes (`npm ci` or the frozen-lockfile equivalent), `wrangler` pinned to an exact version and the
   only development dependency, the deploy command uses the locked local `wrangler`, no unpinned package is installed
   at build time, Dependabot without auto-merge.
3. **`main` is protected** (owner conditions, applied on the repository): changes by pull request only, rules apply to
   administrators, no force push, conversation resolution. **Before Workers Builds is connected**, the CI of the Worker
   repository exists and its checks are required, the owner is the code owner of the whole tree, and actions are pinned
   by SHA and restricted ([deploy](../contracts/deploy.md) section 12). On 2026-11-10 the repository had none of the
   three, so connecting Workers Builds comes after them.
3a. **Each merge to the Worker `main` is a production deploy and needs the owner's explicit OK for that merge.** The
   standing merge OK of D-31 covers the site repository only. Agents share the owner's GitHub account (D-17), so this
   gate is procedural. Regente records this rule in the Decisions note.
4. **Configuration in `wrangler.jsonc`**, checked by the CI of the Worker repository: no `routes`, `route`, `env` or
   `triggers.routes` key; `workers_dev` and `preview_urls` both `false`; `observability.enabled` false (D-20); one cron;
   `keep_vars` absent, so the repository is the source of truth for variables. The shape is in
   [members-json](../contracts/members-json.md) 2.1.
5. **Route by hand.** Created once in the dashboard (exact pattern, fail open) by the owner, or Guindaste with the
   owner's OK. Builds never create or edit it, and the build token has no route permission.
6. **Build token: the narrowest the documentation allows, trimmed before the first build.** Not the automatic one,
   and **dedicated to this Worker** (not shared with the relay), so it can be revoked alone. A custom user token,
   limited to the one account and to no zone, with **Workers Scripts (edit) and Account Settings (read)** and nothing
   else at the start: no Workers Routes, no R2, no KV. Further permissions are added one at a time only if a real
   build fails without them, in this order of likelihood: User Details (read) and Memberships (read), then Workers KV
   Storage (edit), each with its reason in the Ops Runbook. The minimum set is **not documented by Cloudflare** (see
   Not verified), so this is a starting point. **Expiry: 90 days preferred**, rotation date in the Ops Runbook; the
   owner may explicitly accept no expiry. When a token expires builds fail closed with the "build token deleted or
   rolled" error.
7. **Invite code in the Worker repository, committed** (`vars` in `wrangler.jsonc`, public values reviewed by pull
   request), **plus a scheduled check in the site repository** that compares them with `src/data/site.yaml`
   ([deploy](../contracts/deploy.md) section 8). Chosen over dashboard variables with `keep_vars` because the repository
   stays the source of truth: a dashboard variable changes without a pull request, is invisible to review and to the
   configuration check, and is exactly the kind of setting a stolen token can alter silently. The cost is two copies of
   one public value, which the check detects. The rotation order is in members-json 2.6.
7a. **Post-deploy route check.** There is no workflow after a Workers Builds deploy. The owner (or Guindaste with the
   owner's OK) reads the zone's Workers route list in the dashboard after each Worker deploy and once a month; the
   entry is in the Ops Runbook. An automated read-only Routes token inside the integrity workflow was considered and
   not chosen: it would put a Cloudflare credential back into GitHub. The owner may choose it later (T-23).
7b. **Edge rules before the route.** The rate limit and the query-string refusal of members-json 2.9 are mandatory and
   are in place **before** the route goes live.
8. **Rollback**: revert the pull request (a new build deploys the previous code), or use Workers versions in the
   dashboard, or remove the route (the origin file serves the built-in value).

## Rejected

- **GitHub Actions with a protected environment (ADR-0003, D-18)**: gave an explicit approval per deploy and a token
  of our choosing. Replaced by the owner's decision: one place to manage Workers (as for the relay), with the risk
  below accepted.
- **The automatic build token**: adds Workers Routes (edit) on every zone and R2 (edit), neither needed by this Worker.
- **Keeping `worker/` in the site repository with Workers Builds**: the Builds connection would see the whole site
  repository; the owner asked for Worker code only.

## Residual risk (stated plainly)

- **An account-wide token is held by Cloudflare.** Workers Scripts (edit) applies to every Worker in the account; the
  permission lists in the documentation do not offer a per-script scope (not verified beyond that). The token belongs
  to the owner's user, so it also stops working if that membership changes. Anyone who obtains it can change any Worker
  on the account, outside GitHub.
- **Merge to `main` is the only gate.** There is no separate approval step per deploy any more (ADR-0003 had one); the
  owner's explicit OK for each merge (item 3a) takes its place. A merged change reaches production within minutes.
  Author and approver can be the same account (D-17), so the gate is procedural. Compensating controls: pull request only, rules enforced for administrators, required checks and code
  owner, a Worker of about 100 lines with no runtime dependency, content validation and fail-open route in the
  contract (a malicious merge can still publish any integer).
- **Preview builds off is a dashboard setting.** Cloudflare's documentation does not show the default, and the
  repository cannot verify it. If someone turns it on, branches would build with the token. The owner reads the
  setting back at setup and Guindaste at the monthly review.
- **Fork pull requests are not documented.** The Cloudflare pages say nothing about forks. With preview builds off,
  only commits on `main` build, and `main` takes pull requests that the owner merges, so code from a fork reaches a
  build only after merge. That reasoning is mine, not Cloudflare's.
- **Lost with ADR-0003**: the automated post-deploy route check and its read-only token. Replacement: item 7a (the
  owner reads the route list after each deploy and monthly); the integrity monitor
  ([deploy](../contracts/deploy.md) section 8) keeps checking the public endpoint.
- **Panel or local deploys bypass the repository gate.** Anyone with the token or the account can run `wrangler deploy`
  or edit the Worker in the dashboard; only the monthly review and the monitor can notice.
- **Quota shared with the other Workers on the account** and not bounded by the per-IP rate limit (members-json 2.9).
- Whether to move the Worker to its own Cloudflare account remains an owner decision.

## Consequences

- No Cloudflare credential exists in GitHub. The site repository loses `worker-deploy.yml`, the `worker-production`
  environment, the lint rule about that environment, the worker config check and the `worker/` ownership lines.
- Changing the invite touches two repositories (members-json 2.6).

## Not verified

- Minimum permissions of the Workers Builds token (Cloudflare lists only the default set), and whether a token without
  Workers Routes (edit) and R2 (edit) deploys successfully. Confirmed only by the first real build.
- Default state of Enable Preview Builds; any config-file equivalent (only the Builds API `previews_enabled` is
  documented).
- Behavior for pull requests from forks, and what the Cloudflare GitHub app is permitted to do.
- That `wrangler deploy` with `workers_dev` false, `preview_urls` false and no routes succeeds and leaves a hand-made
  route untouched: the documentation says routes are left to the dashboard when the keys are absent, but this exact
  combination is not exercised. Whether a deploy keeps or removes a cron created in the dashboard is not documented;
  the cron is declared in `wrangler.jsonc`, so it does not matter here.
- Whether Workers Builds runs dependency lifecycle scripts and detects the package manager from the lockfile
  (Forja confirms on the first build).
- That `observability.enabled: false` overrides an earlier dashboard setting (carried over from ADR-0003).
