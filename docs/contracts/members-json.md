# Contract: `/data/members.json` (live member count)

- Version: **1** (`schema: 1`). Owner: Alicerce. Producer: Cloudflare Worker, in its own repository `EmpireCommunity/EmpireCommunitySite-Worker` (D-55),
  fed by a small relay on the VPS (2.11, B-WK1). Consumers: the site page script (Vitral), Forja (Worker and relay code),
  Guindaste (relay deploy), Ensaio (tests), Sentinela (threat model), later EmpireBot as an alternative source.
- Decisions: D-13 (Worker every 12 h, invite endpoint, no token, served on the site domain, EmpireBot may take over
  the same contract), D-14 (the page shows only the last value, never a date; exactness does not matter), D-55 (the
  Worker lives in its own repository and deploys through Workers Builds on merge to `main`, [ADR-0004](../adr/0004-members-worker-workers-builds.md)),
  D-82 (fix B-WK1 now: the Worker reads the invite count through the relay, because Discord answered 4xx to the
  Worker's own calls while the same call from the VPS answers 200, [ADR-0005](../adr/0005-members-relay-on-the-vps.md)).
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
| `name` | `empirecommunitysite-worker` (D-61). It must equal the Worker name in the Cloudflare dashboard or the build fails (ADR-0004). The KV namespace title is a separate name and stays `empirecommunity-members`; the Worker reaches it only through the binding `MEMBERS_KV`. |
| `main`, `compatibility_date` | the entry file and a fixed date, both required by Wrangler |
| Route | `empirecommunity.org/data/members.json`, exact pattern, **no trailing `*`**, **fail open**. **Not declared in `wrangler.jsonc`** (no `routes`, `route` or `triggers.routes` key, no `env` block): created once by hand in the Cloudflare dashboard (see 2.9). |
| `workers_dev`, `preview_urls` | both `false` (no `workers.dev` address, no preview URLs) |
| Cron Trigger | `triggers.crons`: exactly `["0 */12 * * *"]` (UTC, so 00:00 and 12:00). One trigger. |
| KV binding | `kv_namespaces`: one entry, binding `MEMBERS_KV`, one namespace created by hand; its id goes in `wrangler.jsonc` (an id is not a secret) |
| `vars.MEMBERS_SOURCE` | `discord-invite` (later `empirebot`). It names where the number comes from, a Discord invite, not the host the Worker calls. |
| Upstream URL | `https://empirecommunity.org/data/members-source.json`, the relay of 2.11. A **constant in the code**, never a variable or a binding, so the Worker has one fixed destination. |
| `vars.DISCORD_INVITE_CODE` | the approved invite code, public, **committed in `wrangler.jsonc`** (see 2.6). Format `^[A-Za-z0-9-]{2,32}$`. |
| `vars.DISCORD_GUILD_ID` | the guild id, public, committed. Format `^[0-9]{17,20}$`; handled as a string, never a number. |
| `keep_vars` | **absent**: the repository is the source of truth, so a variable edited in the dashboard is overwritten by the next deploy (Wrangler "source of truth"). |
| `observability` | `{ "enabled": false }`: Workers Logs, invocation logs and traces off (D-20). The Worker code makes no `console.*` call. See 2.10. |
| Dependencies | no runtime dependency. Development dependencies limited to the tools the checks of this contract need: `wrangler`, `typescript`, `vitest` with `@vitest/coverage-v8`, `@cloudflare/workers-types`, `@types/node`, `eslint` with `typescript-eslint`, `ajv` with `ajv-formats` (schema test of section 7) and `jsonc-parser` (config check) and `yaml` (the workflow lint parses workflow files as YAML, the same parser as the site). Exact versions in a lockfile with integrity hashes, install scripts only for `esbuild` and `workerd`; a new development dependency is a supply chain change with its reason in the pull request (ADR-0004: the build token is in the environment while install scripts run). |

There is no secret in this design: the invite endpoint needs no token, the relay serves a public value without
authentication, and the public endpoint has no write path. The Worker has no build variables or secrets in Workers
Builds either.

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
`updatedAt` and `source` only. The record is written only on a Cron run (success or failure). The one exception: when
there is no previous record and the run fails, nothing is written to this key (the record needs `members` and
`updatedAt`), so a missing key means no run has ever succeeded.

**Run status, key `members:status:v1`** (B-WK1). A second key, written at the end of **every** Cron run, also when no
value was ever stored, so a failing first run can be diagnosed without logs:

```json
{
  "at": "2026-11-15T00:00:04.000Z",
  "outcome": "written",
  "lastError": null,
  "httpStatus": 200
}
```

- `at`: the time of the run, same format as `updatedAt`.
- `outcome`: `written` when the run accepted a new value, `kept` in every other case.
- `lastError`: `null` or the code of 2.4 for this run (`out_of_band` included).
- `httpStatus`: the HTTP status of the **last attempt** of the run as an integer, or `null` when that attempt got no
  HTTP response (network error or timeout).
- The key is one record overwritten on each run, not a log. It holds no visitor data, is never read by the HTTP
  handler and is never public. It is written after the `members:v1` write and independently of it: a failure of one
  write does not stop the other. If reading `members:v1` throws, the run stops and writes neither key, as before.

Two keys and two runs per day make about 4 KV writes per day.

### 2.3 Cron run (every 12 h)

1. Read `members:v1` (may not exist yet).
2. `GET https://empirecommunity.org/data/members-source.json` (the relay, 2.11), no query string, no `Authorization`,
   no cookie, header `User-Agent: EmpireCommunitySite-members/1 (+https://empirecommunity.org)`, `redirect: 'manual'`
   (a redirect is never followed; workerd rejects `redirect: 'error'`), timeout 8 s, response read with a 64 KB cap.
   The Worker no longer calls `discord.com`: the relay does, from the VPS (B-WK1). The request goes through the zone
   like any other, so the edge rules of 2.9 apply to it.
3. Validate the response with the **pure functions** `parseInvite` and `checkFreshness` (2.5). Decide with the **pure
   function** `decide` (2.5). Write the KV record accordingly, then the run status (2.2).
4. Emit **no log**. The outcome of the run is recorded only in KV (2.2): `updatedAt`, `lastError`,
   `consecutiveFailures`, `outOfBandStreak` in the record, and the run status key.

### 2.4 Failure handling (the page keeps the last value in every row)

| Situation | Worker behavior | `lastError` | Public result |
|---|---|---|---|
| 200 and valid and in band | write new value, reset counters | `null` | new value |
| Network error, timeout or HTTP 5xx (a `503` is the relay saying it has no fresh value, 2.11) | up to 2 retries (2 s, then 6 s) inside the same run; then keep value, `consecutiveFailures + 1` | `upstream_unavailable` | last good |
| HTTP 429 (the edge rate limit of 2.9) | honor `Retry-After` if 10 s or less (one retry), otherwise stop; keep value, count a failure | `rate_limited` | last good |
| Any other status below 500 and not 200 or 429 (a 3xx included, never followed; a `404` means the relay route is missing, a `403` an edge refusal) | one attempt, no retry; keep value, count a failure | `invalid_response` | last good |
| 200 but wrong shape, wrong `code`, wrong `guild.id`, count out of bounds, or `fetchedAt` missing or malformed | keep value, count a failure | `invalid_response` | last good |
| 200 and valid, but `fetchedAt` older than 24 h or more than 5 minutes ahead of the run time | treated as unavailable (same retries); keep value, count a failure | `upstream_unavailable` | last good |
| In bounds but a jump (`new < last * 0.5` or `new > last * 2`, only when `last >= 50`) | keep value, count a failure, `outOfBandStreak + 1`; at 3 consecutive such runs (36 h) accept the new value and reset. Any run that is not such a jump (in band, or any failure) resets `outOfBandStreak` to 0, so the three runs are really consecutive | `out_of_band` | last good, then new |
| No previous value and the first run fails | nothing to serve; `decide` returns `keep` with no record and nothing is written to `members:v1`; the run status key is written (2.2) | in the run status only | origin built-in file |
| KV read fails or key missing at request time | pass the request through to the origin | n/a | built-in value |
| Any exception in the HTTP handler | catch (no log), pass through to the origin | n/a | built-in value |
| Workers Free daily limit exceeded (error 1027) | route is **fail open**: Cloudflare bypasses the Worker | n/a | built-in value |
| Cron stops running (account issue, removed trigger) | nothing detects it | n/a | last good, ageing forever (accepted by D-14) |

The code `invite_not_found` is **no longer produced** (the Worker does not call Discord, and a `404` now means a missing
relay route); it stays an accepted value of `lastError` so that an older record still parses. A deleted invite now
shows as `upstream_unavailable` with `httpStatus` 503 once the relay's last value is older than 24 h, and the relay's
own outcome line says why (2.11).

There is no alerting channel in v1. Operators diagnose from the stored record and the run status only (2.10):
`updatedAt` older than 3 days means the Cron is failing, and `lastError` with `httpStatus` says why (see open questions).

### 2.5 Pure functions (unit-tested, see section 7)

`parseInvite(json, config) -> { ok: true, members } | { ok: false, code }`:

- `json.code === config.inviteCode`;
- `json.guild.id === config.guildId` (a wrong or reassigned code can never publish another server's count);
- `Number.isInteger(json.approximate_member_count)` and `1 <= value <= 1_000_000`.

`checkFreshness(json, now) -> 'fresh' | 'stale' | 'malformed'` (B-WK1):

- `malformed` when `json.fetchedAt` is not a string in the exact form `YYYY-MM-DDTHH:mm:ss.sssZ` naming a real instant;
- `stale` when it is older than 24 hours or more than 5 minutes ahead of `now`;
- `fresh` otherwise. `now` is injected, never read from the clock inside the function.

`decide(last, candidate) -> { action: 'write' | 'keep', record }` applies the band rule above and the counters.

### 2.6 Invite code configuration (two copies, one check)

- The approved invite exists in **two places**, both public and both changed only by pull request: `src/data/site.yaml`
  (`discord.inviteCode`, `discord.guildId`; site-data section 4) in the site repository, which builds the `/discord`
  page ([routing-locale](routing-locale.md), D-29), and `vars.DISCORD_INVITE_CODE` and `vars.DISCORD_GUILD_ID` in
  `wrangler.jsonc` of the Worker repository. Under D-55 the site file is no longer readable at deploy time, so a single
  source is not possible without moving the value into a dashboard variable.
- **A third copy of the code only** (B-WK1): `DISCORD_INVITE_CODE` in the relay compose template
  `deploy/members-source/compose.yml` of the site repository (2.11). It sits in the same repository as `site.yaml`, so
  the site CI fails when the two differ ([deploy](deploy.md) section 13) and they cannot drift on `main`. The relay
  that is **deployed** can lag `main`; the Worker then sees a `code` different from its own and keeps the last value
  (`invalid_response`), so a lag freezes the count and never publishes another invite's number.
- **Why committed variables and not dashboard variables with `keep_vars`** (ADR-0004 item 7): the repository stays the
  source of truth, reviewed by pull request and covered by the configuration check; a dashboard variable changes with
  no pull request, is invisible to review and is the kind of setting a stolen token alters silently. The cost is two
  copies of one public value, and the check below catches a difference.
- **Consistency check** (a row of the scheduled integrity workflow in the site repository, [deploy](deploy.md)
  section 8): it reads the public file `wrangler.jsonc` on `main` of the Worker repository and compares both values
  with `src/data/site.yaml` on `main` of the site. A different guild id is always a failure. A different code is a
  failure too, which during the rotation below is expected between its steps 2 and 3 and clears on the next run.
  **Until that workflow exists** (it is not written yet, deploy section 8), the rotation below uses a **manual
  comparison** instead: the person rotating reads the two public values in `wrangler.jsonc` on `main` of the Worker
  repository and in `src/data/site.yaml` on `main` of the site, and confirms the guild ids are equal and the codes are
  equal. The rotation never depends on a check that does not exist.
- **Rotating the invite, in this order.** (1) Create the new invite in Discord and keep the old one valid. (2) A pull
  request in the **Worker repository** changes the two variables; merge needs the owner's explicit OK (ADR-0004
  item 3a) and deploys through Workers Builds: the Worker now counts through the new code (it still checks the guild
  id). **A merge can land while the build fails**, so confirm in the Workers Builds history that the build and
  deployment of that merge commit succeeded, and that the deployed Worker version is that commit's. (3) A pull request in the **site repository** changes `site.yaml` **and the relay compose template in the same change**; merge, then release and deploy the site
  and **redeploy the relay** ([deploy](deploy.md) sections 6 and 13). Steps 2 and 3 may be swapped, because both invites are valid until step 5; between the Worker
  deployment and the relay redeploy the two codes differ and the count stays at its last value (D-14 accepts that), so do both on the same day. (4) Verify, all of it: the live
  `/discord` page carries the new invite; the new invite lookup returns the configured guild; the manual comparison
  above passes (or, once the integrity workflow exists, its consistency row passes); the relay answers with the new `code`; and the Worker works through the
  new code, shown by `updatedAt` in the KV record advancing with `lastError` null (run status `written`) after the Worker deployment of step 2
  and the relay redeploy of step 3 (run the Cron once or wait for the next one). (5) Only when **a successful production deployment of the Worker
  commit that carries the new invite** (step 2)**, the live site release and the redeployed relay** (step 3) are all confirmed, revoke the
  old invite. Revoking earlier leaves visitors with a dead link until the site release is live, and freezes the count if
  the Worker deployment never happened. If an invite is deleted
  unexpectedly, the count freezes at the last value (the relay has nothing fresh after 24 h and answers 503) until both
  repositories hold a valid code and the three deploys are done.
- Rejected: reading `site.yaml` at deploy time (not possible across repositories without a token or a fetch at build
  time, a new moving part in a pipeline that holds the deploy token); deriving the code by following the `/discord`
  page at run time (an extra moving part and a self-request, for a value that changes rarely).
- Only this one invite code is ever used by the Worker, the relay, the `/discord` page and the integrity check. The superseded
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
| Subrequests per invocation | 50 | at most 3 fetches to the relay, plus 1 KV read and 2 KV writes |
| Worker requests per day | 100,000 **per account** (shared with every Worker on the account), then error 1027 (route fail open bypasses this Worker) | one per visitor page view. The per-IP rate limit below does **not** bound this budget (see "What the rate limit does not do" in 2.9) |
| KV reads per day | 100,000 | cache-backed, well below |
| KV writes per day | 1,000; same key at most 1 per second | about 4 (two keys, two runs) |
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
5. **The relay path** (2.11, B-WK1). `/data/members-source.json` is under `/data/`, so rule 1 limits it too; the
   relay itself refuses a query string (404), so rule 2 is not extended to it. The path has **no Worker route**: it
   never uses the Worker request quota and is answered by the relay on the VPS. No new edge rule is required. The
   Worker's own fetch (2.3) is a same-zone subrequest that these rules see; at one to three requests per run it stays
   far below the limit. A zone feature that challenges or blocks that subrequest would freeze the count (section 9).
6. **Test.** From one address, more than the limit within 10 seconds against `/data/members.json` and against
   `/data/members.json?x=1` both return 429 (the second may return the query-string block first, which is also a
   refusal); a single request without query returns the JSON.

### 2.10 Observability off (D-20) and diagnosis

Data minimization: the Worker keeps no request or invocation logs.

- `wrangler.jsonc` sets `observability.enabled` to `false` (this also turns off invocation logs and traces), and the
  code contains no `console.*` call. The CI of the Worker repository fails if `observability` is missing or not disabled,
  or if a `console.` call appears in `src/`.
- **Diagnosis uses only what is stored.** An operator with account access reads two KV keys in the dashboard:
  `members:v1` (`updatedAt` of the last success, `lastError`, `consecutiveFailures`, `outOfBandStreak`) and
  `members:status:v1` (time, outcome, error code and HTTP status of the **last run**, present even when no value was
  ever stored, 2.2). The public file shows `updatedAt` and `source`, which the integrity monitor checks
  ([deploy](deploy.md) section 8). On the VPS, the relay's outcome lines (2.11) say what Discord answered. Nothing
  else is needed or stored, and **Worker logs are never turned on to diagnose** (B-WK1 was open for days because the
  first run's status code was recorded nowhere; the run status key closes that gap).
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

### 2.11 Relay on the VPS (B-WK1, D-82)

Why it exists: Discord answered 4xx to both subrequests of every Cron run made from the Worker (shared Cloudflare
egress; the status code was never recorded), while the same call from the VPS answers 200. The relay makes the call
from the VPS and hands the Worker only what it needs. It holds no secret and stands where EmpireBot may stand later
(section 5).

**Process.** One file, no dependency, run directly by a stock Node image with no build step; source and compose
template in `deploy/members-source/` of the site repository. Container, deploy and CI rules: [deploy](deploy.md)
section 13.

**Fetching Discord.**

- At start and then every 6 hours: `GET https://discord.com/api/v10/invites/{DISCORD_INVITE_CODE}?with_counts=true`,
  no `Authorization`, header `User-Agent: EmpireCommunitySite-members/1 (+https://empirecommunity.org)`, redirects
  never followed, timeout 8 s, body read with a 64 KB cap. `DISCORD_INVITE_CODE` is the only setting, a public value
  matching `^[A-Za-z0-9-]{2,32}$`; the process exits at start when it is missing or malformed.
- A failed cycle is retried **once**, 10 minutes later, then the next cycle is awaited. A 429 whose `Retry-After` is
  longer than 10 minutes skips that retry.
- **The relay never calls Discord because of an incoming request.** Visitors cannot spend its rate limit.
- A response replaces the stored value only when it is HTTP 200, a JSON object, `code` equals `DISCORD_INVITE_CODE`,
  `guild.id` is a string matching `^[0-9]{17,20}$` and `approximate_member_count` is an integer from 1 to 1,000,000.
  Anything else leaves the stored value as it is.
- **Projection only.** The value is kept in memory (nothing on disk) as exactly the four fields below. Every other
  field of Discord's answer is discarded at once: it carries the inviter's user object, the channel and the server
  profile, which MUST NOT be republished or stored.

**Serving.** `GET` and `HEAD` on exactly `/data/members-source.json`, listening on port 8080:

```json
{
  "code": "abc123",
  "guild": { "id": "100000000000000000" },
  "approximate_member_count": 887,
  "fetchedAt": "2026-11-14T12:00:03.120Z"
}
```

| Case | Answer |
|---|---|
| A stored value not older than 24 h | `200`, the body above, `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` |
| No stored value yet, or it is older than 24 h | `503`, empty body, `Cache-Control: no-store` |
| That path with a non-empty query string | `404` |
| That path with another method | `405` with `Allow: GET, HEAD` |
| `GET /healthz` (container health only; Traefik does not route it) | `200` whenever the process is serving, whatever the state of the value, so a relay without data stays routed and answers 503 itself |
| Anything else | `404` |

- The field names are Discord's, so the Worker's `parseInvite` applies unchanged and the **identity check stays in the
  Worker** against its own variables. `fetchedAt` is the time of the successful Discord call, in the format of
  `updatedAt`.
- No `Set-Cookie`, no `Access-Control-*`, no authentication: the body is three public values and a time.
- **No access log and nothing written per request** (D-20). The process MAY write one line per fetch cycle with the
  time and the outcome (the HTTP status or an error class), never a response body and never request data.
- Public exposure: Traefik routes only `Host` `empirecommunity.org` with `Path` `/data/members-source.json` to it
  ([deploy](deploy.md) section 13). Anyone may read it; that is accepted, and the edge rate limit of 2.9 covers it.

**Failure.** Relay or VPS down, route missing, Discord refusing: the Worker keeps the last good value (2.4) and the
page keeps working. A value is never invented and never carried past 24 hours.

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
`fetchMembers(env, signal) -> Promise<{ members: number }>`. Since B-WK1 the Worker already reads over HTTPS from the
VPS (the relay, 2.11); EmpireBot taking over means replacing the relay as the thing that answers, not a new path for
the Worker to learn.

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

**Order for the B-WK1 change** (each deploy with the owner's OK): (1) the relay is deployed on the VPS and its public
URL answers 200 with the configured `code` and guild id ([deploy](deploy.md) section 13); (2) only then the Worker
pull request that switches the upstream is merged (a production deploy); (3) after the next Cron run, or one manual
run, `/data/members.json` shows `source` `discord-invite` with a fresh `updatedAt` and the run status says `written`.
If step 3 fails, the run status key tells why; no log is enabled. Rollback of the Worker change leaves the count at
its last value (or the built-in file), never a wrong one.

Checks after a deploy (no workflow does them; ADR-0004 item 7a): the owner reads the zone's Workers route list after each
Worker deploy and once a month, and sees only the one expected pattern; the public endpoint returns the schema
(the integrity monitor, [deploy](deploy.md) section 8, checks it every 6 hours). Rollback: revert the pull request,
or Workers versions in the dashboard, or remove the route (the origin file then serves the built-in value).

## 7. Tests required (per the testing rule: external contract and pure rules)

- `parseInvite`, `checkFreshness` and `decide`: one parametrized table covering every row of 2.4 (valid, wrong guild,
  wrong code, out of bounds, jump, three-jump acceptance, first run failure, `fetchedAt` malformed, stale and ahead).
  Red first.
- Run status: written on a success, on a failure and on a first-run failure with no record; carries the status of
  the last attempt, `null` when there was no HTTP response.
- Relay (site repository): the projection keeps exactly the four fields and drops the rest of a realistic invite
  answer; an answer with another `code`, a malformed guild id or a count out of bounds does not replace the value;
  the serving table of 2.11 (200, 503 without a value, 503 past 24 h, 404 with a query, 405, 404 elsewhere). Time and
  the Discord call are injected.
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
- **Relay (2.11, B-WK1), to be threat-modelled before it is built**: a new public path on the site domain answered by
  a new container on the VPS; the Worker now trusts a response from its own origin instead of Discord's. Controls
  specified: fixed outbound URL built from one validated public setting and no request input (no request can make it
  call anything); Discord is never called on a request; projection of four fields, nothing else of Discord's answer
  kept or served; no secret, no cookie, no log per request, nothing on disk; exact path and methods; hardened
  container reachable only through the proxy network ([deploy](deploy.md) section 13); the Worker still checks code,
  guild id, bounds, band and now freshness. Whoever controls the origin already controls the pages; through the relay
  they gain only the power to publish an integer inside the bounds and the band.
- Residual, mitigated and not eliminated: a malicious merge or a stolen build token can publish any integer; the
  Workers Scripts permission is account-wide and the token is held by Cloudflare; merge to `main` is the gate (ADR-0004); the account-wide Worker request quota is shared and not bounded by the
  per-IP rate limit (2.9, item 4).

## 9. Not verified (confirm in a staging deploy before relying on it)

- That a route-bound Worker can `fetch(request)` through to the origin as the pass-through path assumes, and that the
  Cache API works for this route on the production zone (documented for custom-domain routes, not exercised here).
- **Happened (B-WK1, 2026-11-12 onward):** Discord answered 4xx to the invite call made from the Worker, on every
  Cron run, while the same call from the VPS returned 200. The exact status was never recorded (no logs, and no
  record is written before a first success), so 429 from the shared egress is a likely cause, not a finding. The
  relay of 2.11 is the different producer this section announced.
- That a Cron-triggered Worker `fetch` to its own zone (2.3) reaches the origin without being challenged or blocked
  by a zone feature (the state of bot protection on the zone is not known here). Checked by the first Cron run after
  the Worker change; the run status key shows the status if it is refused. **Agreed fallback** if it is: the VPS
  writes the same projection to a KV candidate key through the Cloudflare API and the Worker validates it from there.
  That adds the first secret of this design (an account-level KV token on the VPS), so it is a High-risk revision of
  this contract, made only on that evidence.
- That Traefik gives the relay router precedence over the site router for the one path (tested by Guindaste at the
  relay deploy).
- Resolved by the first production build (2026-11-11, per the Ops Runbook): the dedicated token with Workers Scripts
  (edit) and Account Settings (read) was enough, with no permission added, and `wrangler deploy` with `workers_dev` and
  `preview_urls` false and no routes succeeded. Still open: that a later deploy leaves the hand-made route untouched
  (the route was created after the first build, so only the next Worker deploy shows it); the default of Enable Preview
  Builds and behavior for pull requests from forks; that dependency install scripts and the package manager behave as
  assumed in Workers Builds. See [ADR-0004](../adr/0004-members-worker-workers-builds.md). Record the results in the
  Ops Runbook.

## 10. Open questions

1. Alerting when the Cron fails for days: resolved without a secret by the scheduled integrity workflow in
   [deploy](deploy.md) section 8, which fails when `updatedAt` is older than 3 days or `source` is `built-in`; GitHub's
   failed-run notification reaches the owner. Depends on the owner keeping those notifications on.
2. The owner confirms the approved invite code that goes into `site.yaml` and into the Worker repository's `wrangler.jsonc` (D-29, 2.6).
3. EmpireBot hosting and endpoint (section 5).
