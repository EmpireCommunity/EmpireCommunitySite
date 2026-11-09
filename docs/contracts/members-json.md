# Contract: `/data/members.json` (live member count)

- Version: **1** (`schema: 1`). Owner: Alicerce. Producer: Cloudflare Worker (this repository, `worker/`). Consumers:
  the site page script (Vitral), Ensaio (tests), Sentinela (threat model), later EmpireBot as an alternative source.
- Decisions: D-13 (Worker every 12 h, invite endpoint, no token, served on the site domain, EmpireBot may take over
  the same contract), D-14 (the page shows only the last value, never a date; exactness does not matter).
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

### 2.1 Resources and configuration (`worker/wrangler.jsonc`, versioned, no secrets)

| Item | Value |
|---|---|
| Worker name | `empirecommunity-members` |
| Route | `empirecommunity.org/data/members.json`, exact pattern, **no trailing `*`**, **fail open**. **Not declared in `wrangler.jsonc`**: created once by hand in the Cloudflare dashboard (see 2.9). |
| `workers_dev`, `preview_urls` | both `false` (no `workers.dev` address, no preview URLs) |
| Cron Trigger | `0 */12 * * *` (UTC, so 00:00 and 12:00). One trigger. |
| KV binding | `MEMBERS_KV`, one namespace created by hand; its id goes in `wrangler.jsonc` (an id is not a secret) |
| `vars.MEMBERS_SOURCE` | `discord-invite` (later `empirebot`) |
| `vars.DISCORD_INVITE_CODE` | invite code, **not written in `wrangler.jsonc`**: supplied at deploy time from `src/data/site.yaml` `discord.inviteCode` (see 2.6) |
| `vars.DISCORD_GUILD_ID` | guild id (public), supplied at deploy time from `discord.guildId` in the same file |
| `observability` | `{ "enabled": false }`: Workers Logs, invocation logs and traces off (D-20). The Worker code makes no `console.*` call. See 2.10. |
| Runtime dependencies | none (only `wrangler` as a dev dependency); tests with `node --test` |

There is no secret in this design: the invite endpoint needs no token and the public endpoint has no write path.

CI fails the build of `worker/` if `wrangler.jsonc` contains a `routes` or `route` key, if `workers_dev` or
`preview_urls` is not `false`, or if it defines `DISCORD_INVITE_CODE` or `DISCORD_GUILD_ID` (one source, 2.6). The deploy credential and its limits are in
[ADR-0003](../adr/0003-members-worker-deploy-credential.md).

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
per day.

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
| In bounds but a jump (`new < last * 0.5` or `new > last * 2`, only when `last >= 50`) | keep value, `outOfBandStreak + 1`; at 3 consecutive such runs (36 h) accept the new value and reset | `out_of_band` | last good, then new |
| No previous value and the first run fails | nothing to serve | the code above | origin built-in file |
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

### 2.6 Invite code configuration

- The invite is defined **once**, in `src/data/site.yaml` (`discord.inviteCode`, `discord.guildId`; site-data section 4),
  public information reviewed in a PR. The `/discord` page of the site is built from the same value
  ([routing-locale](routing-locale.md), D-29), so there is no second copy to keep in step and no Cloudflare rule.
- The Worker gets the two values **at deploy time**: `worker-deploy.yml` reads them from `site.yaml` and passes them
  to `wrangler deploy` as variables, and runs when that file changes as well as when `worker/**` changes
  ([ADR-0003](../adr/0003-members-worker-deploy-credential.md)). Not verified: the exact `wrangler deploy --var`
  syntax for the pinned version; Forja confirms against its documentation, and if it does not fit, a generated
  non-committed config file is the alternative with the same single source.
- Changing the invite means: one PR that changes `site.yaml`, merge, then the site deploy and the Worker deploy (both
  with the owner's OK). If the invite is deleted, the count freezes at the last value (row `invite_not_found`) until
  this is done.
- Rejected: deriving the code by following the `/discord` page at run time (an extra moving part and a self-request,
  for a value that changes rarely).
- Only this one invite code is ever used by the Worker, the `/discord` page and the integrity check.

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
| Worker requests per day | 100,000 **per account** (shared with every Worker on the account), then error 1027 (route fail open bypasses this Worker) | one per visitor page view; the mandatory rate limit below keeps abusive volume out of this budget |
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
   CI. The deploy token has no route-edit permission (ADR-0003).
4. **Test.** From one address, more than the limit within 10 seconds against `/data/members.json` and against
   `/data/members.json?x=1` both return 429 (the second may return the query-string block first, which is also a
   refusal); a single request without query returns the JSON.

### 2.10 Observability off (D-20) and diagnosis

Data minimization: the Worker keeps no request or invocation logs.

- `wrangler.jsonc` sets `observability.enabled` to `false` (this also turns off invocation logs and traces), and the
  code contains no `console.*` call. CI fails the build of `worker/` if `observability` is missing or not disabled,
  or if a `console.` call appears in `worker/src/`.
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

Decision D-18, detailed in [ADR-0003](../adr/0003-members-worker-deploy-credential.md): **GitHub Actions** workflow
`worker-deploy.yml`, run from `main` only, behind a protected environment that needs the owner's approval, with a
Workers-Scripts-only token that has an expiry and no route permission. The pipeline rules (pinning, permissions, no
`pull_request_target`) are in [deploy](deploy.md).

One-time setup, each step with the owner's OK:
1. create the KV namespace by hand and put its id in `wrangler.jsonc`;
2. create the route by hand (exact pattern, fail open), the two edge rules of 2.9, and confirm both site-wide
   Cloudflare features in routing-locale section 5 are off;
3. create the environment and the expiring token, store them only in the environment;
4. run the workflow once, then run the Cron once from the dashboard to seed the value.

Post-deploy check (automatic): only the one expected route points at the Worker, the endpoint returns the schema, and
the `workers.dev` address does not answer. Rollback: Workers versions and deployments in the dashboard, or remove the
route (the origin file then serves the built-in value).

## 7. Tests required (per the testing rule: external contract and pure rules)

- `parseInvite` and `decide`: one parametrized table covering every row of 2.4 (valid, wrong guild, wrong code,
  out of bounds, jump, three-jump acceptance, first run failure). Red first.
- HTTP handler contract: KV hit returns the schema and headers; KV missing or throwing passes through; non-GET gives
  405. Validate the example body against the JSON Schema above.
- Page: the display rule (89, 100, 888, 12 345, both locales) and "invalid payload leaves the built-in value".
- No test reads this document, snapshots output or depends on the real clock (inject `now`).

## 8. For the threat model (Sentinela)

- Assets: integrity of one integer shown on the home page; the deploy credential (ADR-0003); the zone's route
  configuration.
- No personal data, no cookie, no secret and no user input reaches the Worker. The route has no wildcard and **query
  strings are refused at the edge and at the origin** (2.9), so every accepted request has the same exact form.
- Required controls, all specified above: mandatory path rate limit and query refusal before the Worker (2.9); route
  created by hand and absent from the Worker configuration, `workers_dev` and `preview_urls` off, CI check (2.1);
  deploy token without route permission, with expiry, in a protected environment (ADR-0003); fail-open route and
  origin fallback file (2.4, 4); validation of the upstream response by code, guild id, bounds and band (2.5);
  cache keyed on the exact URL (2.7); the integer written with `textContent` only (3); zero runtime dependencies.
- No Worker logs (D-20, 2.10): there is no per-request record to leak or to retain.
- Residual, mitigated and not eliminated: a malicious merge or a stolen deploy token can publish any integer; the
  Workers Scripts permission is account-wide.

## 9. Not verified (confirm in a staging deploy before relying on it)

- That a route-bound Worker can `fetch(request)` through to the origin as the pass-through path assumes, and that the
  Cache API works for this route on the production zone (documented for custom-domain routes, not exercised here).
- That Discord does not answer 429 or 403 to Cloudflare Workers egress addresses for the invite endpoint. A live
  call from an ordinary network returned 200; none was made from a Worker. If it fails, the contract still holds (last value and
  built-in file) but the count would freeze; the fallback plan is a different producer behind the same contract.
- The minimal set of API token permissions for deploy (ADR-0003).

## 10. Open questions

1. Alerting when the Cron fails for days: resolved without a secret by the scheduled integrity workflow in
   [deploy](deploy.md) section 8, which fails when `updatedAt` is older than 3 days or `source` is `built-in`; GitHub's
   failed-run notification reaches the owner. Depends on the owner keeping those notifications on.
2. The owner confirms the approved invite code that goes into `site.yaml` (D-29).
3. EmpireBot hosting and endpoint (section 5).
