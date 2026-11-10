# Contract: `/data/members.json` (live member count)

- Version: **1** (`schema: 1`). Owner: Alicerce. Producer: Cloudflare Worker, in its own repository `EmpireCommunity/EmpireCommunitySite-Worker` (D-55). Consumers:
  the site page script (Vitral), Ensaio (tests), Sentinela (threat model), later EmpireBot as an alternative source.
- Decisions: D-13 (Worker every 12 h, invite endpoint, no token, served on the site domain, EmpireBot may take over
  the same contract), D-14 (the page shows only the last value, never a date; exactness does not matter), D-55 (the
  Worker lives in its own repository and deploys through Workers Builds on merge to `main`, [ADR-0004](../adr/0004-members-worker-workers-builds.md)).
- This contract stays in the site repository; the Worker repository links to it and holds code only. A change to the
  contract is announced to both.
- A change to this contract is announced to Forja, Vitral and Regente before it lands.
- Keywords MUST, SHOULD, MAY are used as in RFC 2119.

## 1. Public endpoint

`GET https://empirecommunity.org/data/members.json` (also `HEAD`). Same origin as the pages, so no CORS headers are
sent and none are needed.

### Response 200

```json
{
  "schema": 1,
  "discord": {
    "members": 888,
    "updatedAt": "2026-11-09T00:00:03.120Z",
    "source": "discord-invite"
  }
}
```

JSON Schema (draft 2020-12), the normative form:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "members.json v1",
  "type": "object",
  "required": ["schema", "discord"],
  "properties": {
    "schema": { "const": 1 },
    "discord": {
      "type": "object",
      "required": ["members", "updatedAt", "source"],
      "properties": {
        "members": { "type": "integer", "minimum": 1, "maximum": 1000000 },
        "updatedAt": { "type": "string", "format": "date-time" },
        "source": { "enum": ["discord-invite", "empirebot", "built-in"] }
      }
    }
  }
}
```

- `members` is the approximate member count (the Discord field is documented as approximate and includes bots).
- `updatedAt` and `source` are **for operators only**. The page MUST NOT display them (D-14).
- Producers emit only these fields. Consumers MUST ignore unknown fields (additive changes keep `schema: 1`). A
  breaking change raises `schema`; a consumer that sees another value MUST behave as if the request failed.
- WhatsApp is not in this file. Its manual value lives in `src/data/community.yaml` (site-data) and is pt-BR only.

### Headers (Worker response)

| Header | Value |
|---|---|
| `Content-Type` | `application/json; charset=utf-8` |
| `Cache-Control` | `public, max-age=600` (not `no-transform`; that value would stop Cloudflare Web Analytics injection) |
| `X-Content-Type-Options` | `nosniff` |
| `Set-Cookie`, `Access-Control-*` | never sent |

Other methods: `405` with `Allow: GET, HEAD`. The Worker never returns a 4xx or 5xx for a data problem; it falls back
to the origin file (section 4).

## 2. Producer: the Worker

### 2.1 Resources and configuration (`wrangler.jsonc` at the root of the Worker repository, versioned, no secrets)

| Item | Value |
|---|---|
| `name` | `empirecommunity-members`. It must equal the Worker name in the Cloudflare dashboard or the build fails (ADR-0004). |
| `main`, `compatibility_date` | the entry file and a fixed date, both required by Wrangler |
| Route | `empirecommunity.org/data/members.json`, exact pattern, **no trailing `*`**, **fail open**. **Not declared in `wrangler.jsonc`** (no `routes`, `route` or `triggers.routes` key, no `env` block): created once by hand in the Cloudflare dashboard (see 2.9). |
| `workers_dev`, `preview_urls` | both `false` (no `workers.dev` address, no preview URLs) |
| Cron Trigger | `triggers.crons`: exactly `["0 */12 * * *"]` (UTC, so 00:00 and 12:00). One trigger. |
| KV binding | `kv_namespaces`: one entry, binding `MEMBERS_KV`, one namespace created by hand; its id goes in `wrangler.jsonc` (an id is not a secret) |
| `vars.MEMBERS_SOURCE` | `discord-invite` (later `empirebot`) |
| `vars.DISCORD_INVITE_CODE` | the approved invite code, public, **committed in `wrangler.jsonc`** (see 2.6). Format `^[A-Za-z0-9-]{2,32}$`. |
| `vars.DISCORD_GUILD_ID` | the guild id, public, committed. Format `^[0-9]{17,20}$`; handled as a string, never a number. |
| `keep_vars` | **absent**: the repository is the source of truth, so a variable edited in the dashboard is overwritten by the next deploy (Wrangler "source of truth"). |
| `observability` | `{ "enabled": false }`: Workers Logs, invocation logs and traces off (D-20). The Worker code makes no `console.*` call. See 2.10. |
| Dependencies | no runtime dependency. Development dependencies limited to the tools the checks of this contract need: `wrangler`, `typescript`, `vitest` with `@vitest/coverage-v8`, `@cloudflare/workers-types`, `@types/node`, `eslint` with `typescript-eslint`, `ajv` with `ajv-formats` (schema test of section 7) and `jsonc-parser` (config check) and `yaml` (the workflow lint parses workflow files as YAML, the same parser as the site). Exact versions in a lockfile with integrity hashes, install scripts only for `esbuild` and `workerd`; a new development dependency is a supply chain change with its reason in the pull request (ADR-0004: the build token is in the environment while install scripts run). |

There is no secret in this design: the invite endpoint needs no token and the public endpoint has no write path. The
Worker has no build variables or secrets in Workers Builds either.

The CI of the Worker repository (deploy [section 12](deploy.md)) fails if `wrangler.jsonc` contains a `routes`,
`route`, `env` or `keep_vars` key; has `workers_dev` or `preview_urls` other than `false`; lacks `observability`
disabled; has a `triggers.crons` other than the one entry above; lacks `MEMBERS_KV`; lacks `DISCORD_INVITE_CODE` or
`DISCORD_GUILD_ID` or has a value that does not match the formats above; or if a `console.` call appears in `src/`. The deploy path, the build token and its limits are in
[ADR-0004](../adr/0004-members-worker-workers-builds.md).

### 2.2 KV record

One key, `members:v1`, JSON:

```json
{
  "members": 888,
  "updatedAt": "2026-11-09T00:00:03.120Z",
  "source": "discord-invite",
  "consecutiveFailures": 0,
  "outOfBandStreak": 0,
  "lastError": null
}
```

`lastError` is `null` or one short code from the table in 2.4. The public response is built from `members`,
`updatedAt` and `source` only. The record is written only on a Cron run (success or failure), so about 2 to 4 writes
per day. The one exception: when there is no previous record and the run fails, nothing is written (the record needs
`members` and `updatedAt`), so a missing key means no run has ever succeeded.

### 2.3 Cron run (every 12 h)

1. Read `members:v1` (may not exist yet).
2. `GET https://discord.com/api/v10/invites/{DISCORD_INVITE_CODE}?with_counts=true`, no `Authorization`, header
   `User-Agent: EmpireCommunitySite-members/1 (+https://empirecommunity.org)`, timeout 8 s, response read with a
   64 KB cap. (Endpoint and fields checked against the official docs on 2026-11-08: `approximate_member_count`
   is returned when `with_counts=true`; a live call returned HTTP 200 for the current invite without a token.)
3. Validate the response with the **pure function** `parseInvite` (2.5). Decide with the **pure function** `decide`
   (2.5). Write the KV record accordingly.
4. Emit **no log**. The outcome of the run is recorded only in the KV record (2.2): `updatedAt`, `lastError`,
   `consecutiveFailures`, `outOfBandStreak`.

### 2.4 Failure handling (the page keeps the last value in every row)

| Situation | Worker behavior | `lastError` | Public result |
|---|---|---|---|
| 200 and valid and in band | write new value, reset counters | `null` | new value |
| Network error, timeout or HTTP 5xx | up to 2 retries (2 s, then 6 s) inside the same run; then keep value, `consecutiveFailures + 1` | `upstream_unavailable` | last good |
| HTTP 429 | honor `Retry-After` if 10 s or less (one retry), otherwise stop; keep value, count a failure | `rate_limited` | last good |
| HTTP 404 (invite deleted or code wrong) | no retry; keep value, count a failure | `invite_not_found` | last good |
| 200 but wrong shape, wrong `code`, wrong `guild.id`, count out of bounds | keep value, count a failure | `invalid_response` | last good |
| In bounds but a jump (`new < last * 0.5` or `new > last * 2`, only when `last >= 50`) | keep value, `outOfBandStreak + 1`; at 3 consecutive such runs (36 h) accept the new value and reset. Any run that is not such a jump (in band, or any failure) resets `outOfBandStreak` to 0, so the three runs are really consecutive | `out_of_band` | last good, then new |
| No previous value and the first run fails | nothing to serve; `decide` returns `keep` with no record and nothing is written to KV | not stored | origin built-in file |
| KV read fails or key missing at request time | pass the request through to the origin | n/a | built-in value |
| Any exception in the HTTP handler | catch (no log), pass through to the origin | n/a | built-in value |
| Workers Free daily limit exceeded (error 1027) | route is **fail open**: Cloudflare bypasses the Worker | n/a | built-in value |
| Cron stops running (account issue, removed trigger) | nothing detects it | n/a | last good, ageing forever (accepted by D-14) |

There is no alerting channel in v1. Operators diagnose from the stored record only (2.10): `updatedAt` older than 3
days means the Cron is failing, and `lastError` says why (see open questions).

### 2.5 Pure functions (unit-tested, see section 7)

`parseInvite(json, config) -> { ok: true, members } | { ok: false, code }`:

- `json.code === config.inviteCode`;
- `json.guild.id === config.guildId` (a wrong or reassigned code can never publish another server's count);
- `Number.isInteger(json.approximate_member_count)` and `1 <= value <= 1_000_000`.

`decide(last, candidate) -> { action: 'write' | 'keep', record }` applies the band rule above and the counters.

### 2.6 Invite code configuration (two copies, one check)

- The approved invite exists in **two places**, both public and both changed only by pull request: `src/data/site.yaml`
  (`discord.inviteCode`, `discord.guildId`; site-data section 4) in the site repository, which builds the `/discord`
  page ([routing-locale](routing-locale.md), D-29), and `vars.DISCORD_INVITE_CODE` and `vars.DISCORD_GUILD_ID` in
  `wrangler.jsonc` of the Worker repository. Under D-55 the site file is no longer readable at deploy time, so a single
  source is not possible without moving the value into a dashboard variable.
- **Why committed variables and not dashboard variables with `keep_vars`** (ADR-0004 item 7): the repository stays the
  source of truth, reviewed by pull request and covered by the configuration check; a dashboard variable changes with
  no pull request, is invisible to review and is the kind of setting a stolen token alters silently. The cost is two
  copies of one public value, and the check below catches a difference.
- **Consistency check** (a row of the scheduled integrity workflow in the site repository, [deploy](deploy.md)
  section 8): it reads the public file `wrangler.jsonc` on `main` of the Worker repository and compares both values
  with `src/data/site.yaml` on `main` of the site. A different guild id is always a failure. A different code is a
  failure too, which during the rotation below is expected between its steps 2 and 3 and clears on the next run.
- **Rotating the invite, in this order.** (1) Create the new invite in Discord and keep the old one valid. (2) A pull
  request in the **Worker repository** changes the two variables; merge needs the owner's explicit OK (ADR-0004
  item 3a) and deploys through Workers Builds: the Worker now counts through the new code (it still checks the guild
  id). (3) A pull request in the **site repository** changes `site.yaml`; merge, then release and deploy the site
  ([deploy](deploy.md)). Steps 2 and 3 may be swapped, because both invites are valid until step 5. (4) Open the live
  `/discord` page and confirm it carries the new invite, that the next run of the integrity workflow passes the
  consistency row, and that the new invite lookup returns the configured guild. (5) Only then revoke the old invite.
  Revoking earlier leaves visitors with a dead link until the site release is live. If an invite is deleted
  unexpectedly, the count freezes at the last value (row `invite_not_found`) until both repositories hold a valid code
  and both deploys are done.
- Rejected: reading `site.yaml` at deploy time (not possible across repositories without a token or a fetch at build
  time, a new moving part in a pipeline that holds the deploy token); deriving the code by following the `/discord`
  page at run time (an extra moving part and a self-request, for a value that changes rarely).
- Only this one invite code is ever used by the Worker, the `/discord` page and the integrity check. The superseded
  invite is not kept in either repository after step 5.

### 2.7 Public read path

1. Match `GET` or `HEAD` on the exact route.
2. Try the Cloudflare Cache API (`caches.default`) for the request URL; on a hit return it.
3. On a miss read `members:v1`, build the response of section 1, `cache.put` it with the 600 s `Cache-Control`,
   return it. Cache reads keep KV reads far below the Free limit of 100,000 per day.
4. Any problem: `return fetch(request)` to the origin (the built-in file, section 4).

### 2.8 Limits (official docs, checked 2026-11-08; recheck at deploy)

| Limit | Free plan | This design |
|---|---|---|
| Cron Triggers per account | 5 | 1 |
| CPU time per Cron run / per request | 10 ms (waiting on `fetch` and KV does not count) | a few ms |
| Subrequests per invocation | 50 | at most 5 |
| Worker requests per day | 100,000 **per account** (shared with every Worker on the account), then error 1027 (route fail open bypasses this Worker) | one per visitor page view. The per-IP rate limit below does **not** bound this budget (see "What the rate limit does not do" in 2.9) |
| KV reads per day | 100,000 | cache-backed, well below |
| KV writes per day | 1,000; same key at most 1 per second | 2 to 4 |
| KV storage | 1 GB | under 1 KB |
| Rate limiting rules (Free) | 1 rule, counted per IP only, period 10 s, mitigation 10 s | this one rule is used for `/data/` |

### 2.9 Edge protection of the path (mandatory)

The data path is protected **before** the Worker, in the Cloudflare zone. Both rules are part of this contract and
Guindaste copies them into the Ops Runbook with the date applied.

1. **Rate limit, mandatory.** One rate limiting rule on the path prefix `/data/`, matched on the **path only** so that
   it applies identically **with and without a query string**: expression
   `starts_with(http.request.uri.path, "/data/")`; counted per IP; **10 requests per 10 seconds**; action block with
   response 429; mitigation 10 seconds (the Free plan allows one rule, period 10 s and mitigation 10 s only). A
   request over the limit gets 429 whether or not it carries a query string. The values are the starting point and
   may be tuned by Guindaste without changing this contract.
2. **Query strings refused.** A security custom rule blocks `http.request.uri.path eq "/data/members.json"` when
   `http.request.uri.query ne ""`. This removes the only way to reach the origin file around the Worker route, so
   every legitimate request matches the exact route. nginx repeats the refusal at the origin (a non-empty query
   string on `/data/members.json` returns 404) as defense in depth. Availability of custom rules on the Free plan is
   not verified here; if not available, use the nginx refusal plus a Transform or redirect alternative chosen by
   Guindaste with the owner.
3. **Route creation.** The route is created once by hand (exact pattern, fail open) and is never created or edited by
   Workers Builds. The build token has no route-edit permission (ADR-0004). **The two edge rules are in place before the route goes live.**
4. **What the rate limit does not do.** It is counted per IP, so it limits one client and not the total: one address
   at the allowed rate (about 1 request per second) would use most of the 100,000 daily Worker requests that the
   whole account shares, and a few addresses together would exhaust them. The rule reduces noise; it is not a quota
   control, and tightening its numbers is allowed but is not treated as one. When the quota is reached, Cloudflare stops
   running Workers on the account until the daily reset. Because the route fails open, `/data/members.json` is then
   answered by the origin's built-in file (the count shows the built-in value and the page keeps working), and **every
   other Worker on the account stops too**. Proportionate response for a Free-plan site: the member-count Worker is the
   only Worker on the account's quota, or lives in its own Cloudflare account (owner decision, ADR-0004); Guindaste
   reviews the Workers request usage in the dashboard after launch and then monthly, and tells the owner when the daily
   use passes half of the limit; the owner then chooses between a paid plan with a higher quota and removing the live
   count (the built-in value stays). Residual risk accepted by the owner.
5. **Test.** From one address, more than the limit within 10 seconds against `/data/members.json` and against
   `/data/members.json?x=1` both return 429 (the second may return the query-string block first, which is also a
   refusal); a single request without query returns the JSON.

### 2.10 Observability off (D-20) and diagnosis

Data minimization: the Worker keeps no request or invocation logs.

- `wrangler.jsonc` sets `observability.enabled` to `false` (this also turns off invocation logs and traces), and the
  code contains no `console.*` call. The CI of the Worker repository fails if `observability` is missing or not disabled,
  or if a `console.` call appears in `src/`.
- **Diagnosis uses only the stored record.** An operator with account access reads the KV key `members:v1` in the
  dashboard: `updatedAt` (last success), `lastError` (code), `consecutiveFailures`, `outOfBandStreak`. The public file
  shows `updatedAt` and `source`, which the integrity monitor checks ([deploy](deploy.md) section 8). Nothing else is
  needed or stored.
- **Turning logs off is possible.** What Cloudflare still keeps, outside this Worker's control, according to its
  documentation (checked 2026-11-08):
  - Worker **metrics** (request counts, status outcomes, CPU and wall time, memory), for up to three months, and zone
    analytics for the zone (the dashboard offers about 30 days). These are aggregates, not per-visitor records.
  - Cloudflare's own handling of the proxied connection for the zone (its edge records, which include the client
    address), under Cloudflare's terms; the Privacy text says Cloudflare processes the connection (site-data
    section 11). This is not a Worker log and cannot be disabled by this contract.
  - If Workers Logs were left on, each invocation log would contain the request URL and metadata and be kept for up to
    7 days; that is exactly what this section prevents. Real-time logs (`wrangler tail`) are streamed only while
    someone is connected and are not stored; they are not used.
- Not verified: that a `wrangler deploy` with `observability.enabled: false` also overrides a setting made earlier in
  the dashboard. After the first deploy, an operator confirms in the dashboard that Logs are off and that a test
  request produces no entry.

## 3. Consumer: the page

- The HTML always contains the value, rendered at build from `community.yaml` `discord.membersBuiltIn`, inside an
  element marked `data-members-discord`. No loading state, no skeleton, no error text, no date, no layout shift.
- One external script (no inline script, CSP `script-src 'self'`) does, after load:
  1. `fetch('/data/members.json', { credentials: 'omit', cache: 'default', signal: AbortSignal.timeout(4000) })`;
  2. on any error, non-200, wrong `schema`, non-integer or out-of-bounds `discord.members`: do nothing (the built-in
     value stays);
  3. otherwise replace the element's `textContent` with the formatted value. `textContent` only, never `innerHTML`.
- **Display rule (shared module `src/lib/members.ts`, used by the build and by the script so they cannot drift):**
  `n < 100` shows `n`; otherwise `floor(n / 10) * 10` with a trailing `+` (888 becomes `880+`), formatted with
  `Intl.NumberFormat` for `pt-BR` or `en-US`. Exactness does not matter (D-14) and this avoids a falsely precise
  number.
- The element exists in both locales. The WhatsApp count appears only in pt-BR.
- CSP: `connect-src 'self'` covers the fetch.

## 4. Origin fallback file

The build writes `dist/data/members.json` with the same schema from `community.yaml`:
`{ "schema": 1, "discord": { "members": <membersBuiltIn>, "updatedAt": <build time>, "source": "built-in" } }`.
nginx serves it with `Cache-Control: public, max-age=300`. It is what the browser gets when the Worker is bypassed,
passes through or is gone, and `source: "built-in"` tells an operator that this happened. The built-in value is set
by hand from a verified reading and SHOULD be refreshed at each release (never invented).

## 5. Taking over by EmpireBot (D-13), later

The public contract does not change. The Worker stays the only publisher and the validator; only the source changes
(`vars.MEMBERS_SOURCE=empirebot`, `source` becomes `empirebot`). The source adapter interface is:
`fetchMembers(env, signal) -> Promise<{ members: number }>`.

Requirements to agree with the EmpireBot workspace (not defined, EmpireBot has no such endpoint and is not deployed
today): an HTTPS `GET` returning `{ "members": <integer> }`, no personal data. Authentication is
preferably none (the number is public); if EmpireBot wants a bearer token it becomes a Worker secret and this
contract is revised as a High-risk change. The same validation, band and failure rules apply. Not verified: where
EmpireBot would be hosted and exposed.

## 6. Deploy

Decision D-55, detailed in [ADR-0004](../adr/0004-members-worker-workers-builds.md): the Worker lives in
`EmpireCommunity/EmpireCommunitySite-Worker` and is deployed by **Cloudflare Workers Builds** on merge to `main`
(production branch `main`, preview builds off, no build variables). No GitHub Actions workflow deploys it and no
Cloudflare credential exists in GitHub. The build token is a dedicated, trimmed user token held by Cloudflare. The
controls of the Worker repository are in [deploy](deploy.md) section 12.

**Each merge to the Worker `main` is a production deploy and needs the owner's explicit OK for that merge**; the
standing merge OK of D-31 covers the site repository only.

One-time setup, each step with the owner's OK, in this order (the checklist with the exact settings is the Worker
section of the Ops Runbook):
1. the Worker repository has its required checks, code owner and restricted actions (deploy section 12), **before**
   Workers Builds is connected;
2. create the KV namespace by hand and put its id in `wrangler.jsonc`;
3. create the dedicated build token with Workers Scripts (edit) and Account Settings (read) and an expiry
   (ADR-0004 item 6);
4. import the repository in Workers Builds, production branch `main`, **Enable Preview Builds off** and read it back
   in the panel, the dedicated token selected, no build variables;
5. after the first successful build: confirm `workers.dev` and preview URLs are off, then create the **two edge rules
   of 2.9 first and the route by hand after them** (exact pattern, fail open); confirm both site-wide Cloudflare
   features in routing-locale section 5 are off;
6. run the Cron once (or wait for 00:00 or 12:00 UTC) to seed the value.

Checks after a deploy (no workflow does them; ADR-0004 item 7a): the owner reads the zone's Workers route list after each
Worker deploy and once a month, and sees only the one expected pattern; the public endpoint returns the schema
(the integrity monitor, [deploy](deploy.md) section 8, checks it every 6 hours). Rollback: revert the pull request,
or Workers versions in the dashboard, or remove the route (the origin file then serves the built-in value).

## 7. Tests required (per the testing rule: external contract and pure rules)

- `parseInvite` and `decide`: one parametrized table covering every row of 2.4 (valid, wrong guild, wrong code,
  out of bounds, jump, three-jump acceptance, first run failure). Red first.
- HTTP handler contract: KV hit returns the schema and headers; KV missing or throwing passes through; non-GET gives
  405. Validate the example body against the JSON Schema above.
- Page: the display rule (89, 100, 888, 12 345, both locales) and "invalid payload leaves the built-in value".
- No test reads this document, snapshots output or depends on the real clock (inject `now`).

## 8. For the threat model (Sentinela)

- Assets: integrity of one integer shown on the home page; the Workers Builds token (ADR-0004); the zone's route
  configuration.
- No personal data, no cookie, no secret and no user input reaches the Worker. The route has no wildcard and **query
  strings are refused at the edge and at the origin** (2.9), so every accepted request has the same exact form.
- Required controls, all specified above: mandatory path rate limit and query refusal before the Worker (2.9); route
  created by hand and absent from the Worker configuration, `workers_dev` and `preview_urls` off, CI check in the Worker repository (2.1);
  a dedicated, trimmed build token without route permission held by Cloudflare, preview builds off, `main` protected with required checks and the owner's explicit OK for each merge (ADR-0004); fail-open route and
  origin fallback file (2.4, 4); validation of the upstream response by code, guild id, bounds and band (2.5);
  cache keyed on the exact URL (2.7); the integer written with `textContent` only (3); zero runtime dependencies.
- No Worker logs (D-20, 2.10): there is no per-request record to leak or to retain.
- Residual, mitigated and not eliminated: a malicious merge or a stolen build token can publish any integer; the
  Workers Scripts permission is account-wide and the token is held by Cloudflare; merge to `main` is the gate (ADR-0004); the account-wide Worker request quota is shared and not bounded by the
  per-IP rate limit (2.9, item 4).

## 9. Not verified (confirm in a staging deploy before relying on it)

- That a route-bound Worker can `fetch(request)` through to the origin as the pass-through path assumes, and that the
  Cache API works for this route on the production zone (documented for custom-domain routes, not exercised here).
- That Discord does not answer 429 or 403 to Cloudflare Workers egress addresses for the invite endpoint. A live
  call from an ordinary network returned 200; none was made from a Worker. If it fails, the contract still holds (last value and
  built-in file) but the count would freeze; the fallback plan is a different producer behind the same contract.
- The minimal set of permissions of the Workers Builds token, and that a token without Workers Routes (edit) and R2
  (edit) deploys (Cloudflare documents only the default set); the default of Enable Preview Builds; behavior for pull
  requests from forks; that `wrangler deploy` with `workers_dev` and `preview_urls` false and no routes succeeds and
  leaves the hand-made route untouched (the documentation says routes stay with the dashboard when the keys are
  absent, but this combination is not exercised); that dependency install scripts and the package manager behave as
  assumed in Workers Builds. See [ADR-0004](../adr/0004-members-worker-workers-builds.md). Confirm in the first real
  build and record the result in the Ops Runbook.

## 10. Open questions

1. Alerting when the Cron fails for days: resolved without a secret by the scheduled integrity workflow in
   [deploy](deploy.md) section 8, which fails when `updatedAt` is older than 3 days or `source` is `built-in`; GitHub's
   failed-run notification reaches the owner. Depends on the owner keeping those notifications on.
2. The owner confirms the approved invite code that goes into `site.yaml` and into the Worker repository's `wrangler.jsonc` (D-29, 2.6).
3. EmpireBot hosting and endpoint (section 5).
