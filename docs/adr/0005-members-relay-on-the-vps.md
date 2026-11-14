# ADR-0005: The member-count Worker reads Discord through a relay on the VPS

- Status: **Accepted** (owner D-82, fix B-WK1 now; option chosen by Regente on 2026-11-14 from the comparison below).
- Author: Alicerce. Task ref: B-WK1. Specs: [members-json](../contracts/members-json.md) 2.2 to 2.4, 2.6, 2.11 and
  [deploy](../contracts/deploy.md) section 13. Builds on [ADR-0004](0004-members-worker-workers-builds.md), which
  stays in force.
- Risk: High surface (deploy on the host and of the Worker). The chosen design adds no secret.

## Context

- Since its first run on 2026-11-12 the Worker Cron never stored a value. Cloudflare's metrics show two subrequests
  to `discord.com` per run, both 4xx. The status code is unknown: Worker logs are off (D-20) and the record is not
  written before a first success. A 429 from the shared Workers egress is likely and unproven.
- The same request from the VPS answers 200 with the right code, guild id and count (repeated on 2026-11-14).
- Discord's rate limit documentation: requests ending in 401, 403 or 429 count against a per-IP limit of invalid
  requests, after which the address is blocked at Discord's edge. Workers share egress addresses with other customers.
- The live `/data/members.json` therefore serves the origin's built-in file, and the integrity monitor is red on the
  one row that requires a live source.
- Turning Worker logs on to find the status code is not approved (D-20).

## Options

| | A. Bot token in the Worker | B. VPS pushes to KV | C. Worker reads a relay on the VPS |
|---|---|---|---|
| Owner actions | Create a Discord application and bot, add it to the server, store the token as a Worker secret | Create a Cloudflare API token and place it on the VPS | None beyond the OK each deploy already needs |
| Secrets | A bot token that can read server data, held by Cloudflare | A token with KV edit on the whole account, on a VPS shared by every project | None |
| Certain to fix it | No: useless if the egress address is blocked, and the cause cannot be told apart without logs | Yes | Yes for the Discord call; the Worker's fetch to its own zone is the one unproven hop |
| Failure modes | The same freeze as today; token leak or reset | Token expiry or a forgotten rotation freezes the count; a leaked token writes or deletes any KV of the account | Relay or VPS down: the last value stays; one more container and public path |
| Effort | Small, possibly twice | Medium | Medium |

Not compared: removing the Worker and serving the file from the VPS alone. It would reverse D-13 and D-55 and lose
the last-good value and the validation.

## Decision

**C.** A relay on the VPS calls the invite endpoint and serves a four-field projection on the site domain; the Worker
Cron fetches that fixed URL instead of `discord.com` and validates it exactly as before, plus a freshness rule. A
second KV key records the outcome of every run, so a failure can be diagnosed without logs.

**B is the agreed fallback**, used only if the first Cron run after the change shows the zone refusing the Worker's
fetch to its own origin. It would add the first secret of this design and is therefore a High-risk revision of the
contract, made on that evidence and not before.

## Consequences

- The design stays secret-free and the owner creates no token. The Worker keeps being the only publisher and the
  validator; the public schema does not change.
- The count now depends on the VPS for fresh values. When the VPS or the relay is down the last value stays, which
  D-14 accepts.
- One more public path and one more container on the host, with their own compose rules, CI check and deploy
  procedure (deploy section 13). Each relay deploy needs the owner's OK.
- The invite code has a third copy, in the relay template. It lives in the same repository as `site.yaml` and CI
  compares the two; the rotation gains one step (members-json 2.6).
- The error code `invite_not_found` is no longer produced; a deleted invite shows as an unavailable upstream after 24
  hours, and the relay's own outcome line says why.
- This is the shape members-json section 5 planned for EmpireBot: another producer behind the same adapter.

## Not verified

- The status code Discord returned to the Worker.
- That a Cron-triggered Worker fetch to its own zone is not challenged or blocked by a zone feature. The run status
  key shows the status on the first run.
- Traefik precedence of the relay router over the site router on the host (tested at the relay deploy).
