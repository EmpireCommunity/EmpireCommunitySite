# Contract: site data and content schemas

- Version: 1. Owner: Alicerce. Consumers: Vitral (pages and components), Forja (loaders, build checks, CI), Ensaio
  (C-1 to C-4), Sentinela (money and personal data surfaces), Regente (content intake from the owner).
- Decisions: D-2, D-3, D-5, D-6, D-7, D-14, D-21, D-22, D-23, D-28, D-29, D-41 (D-16 is superseded by D-21; D-41 amends D-29). Stack: [ADR-0001](../adr/0001-stack.md). Routes and locales:
  [routing-locale](routing-locale.md). Member count endpoint: [members-json](members-json.md).
- Risk: **High** for `team.yaml` (personal data). `support.yaml` is **Medium at launch**: public goal figures and a
  "donations not open" state, no payment instruction (D-28). The change that opens donations is High and has its own
  contract. The other files are Low or Medium.
- Examples below are **illustrative placeholders**, not facts. Real values come from the owner; nothing is invented
  and a section with no real data is not rendered (C-4).

## 1. Layout

```
src/
  content.config.ts            # collections and Zod schemas below (Zod as exposed by Astro)
  i18n/messages/pt-br.json     # master locale for UI strings
  i18n/messages/en-us.json     # same key set as pt-br.json (type assertion in i18n/index.ts, plus a test)
  i18n/index.ts                # Messages type, t() helper
  data/site.yaml               # one document
  data/community.yaml          # one document
  data/projects.yaml           # collection
  data/game-servers.yaml       # collection
  data/join-channels.yaml      # collection
  data/community-rules.yaml    # one document (rules text and date shown on /discord, D-41), section 14
  data/team.yaml               # collection
  data/support.yaml            # one document (goal, parts, donations state), read only through src/lib/support.ts
  content/legal/pt-br/terms-of-service.md   privacy-policy.md
  content/legal/en-us/terms-of-service.md   privacy-policy.md
  lib/routes.ts  lib/members.ts  lib/support.ts
  assets/                      # images referenced by data files
```

Every YAML file goes through the custom `yamlLoader` in `src/lib/yaml-loader.ts`, **not** Astro's `file()` loader:
`file()` only logs an error and carries on when a file is malformed, has no ids or is missing, and only warns on a
duplicate id, so a broken data file could still produce a green build. `yamlLoader` fails the build on each of those
(a missing file fails unless the collection is declared `optional`), takes per-entry schema errors from the
collection's Zod schema through `parseData`, and runs a cross-entry `validate` callback after every load. Collections
are parsed by `parseEntryList` and one-document files (`site.yaml`, `community.yaml`, `community-rules.yaml`) by
`parseSingleDocument`, both in `src/lib/yaml-entries.ts`. **Any schema error fails the build** with the file, the
entry id and the field.

## 2. Common types and rules

```ts
const Locale = z.enum(['pt-br', 'en-us']);
const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);          // unique per collection, never renamed
const PersonId = z.string().regex(/^p-[0-9a-f]{12}$/);            // opaque, random, never derived from a name or nickname
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Cents = z.number().int().min(0).max(100_000_000);           // money is integer cents, currency BRL
const Text = (max: number) => z.string().trim().min(1).max(max).refine(noHtml);   // plain text, no markup
const Localized = (max: number) => z.object({ 'pt-br': Text(max), 'en-us': Text(max) }).strict();
const LocalizedFor = (audience, max) => /* keys exactly equal the entry's audience */;
const HttpsUrl = z.string().url().startsWith('https://').refine(noUserinfoNoTrackingParams);
const Image = z.object({ src: z.string(), alt: Localized(140), decorative: z.boolean().default(false) });
```

- `Localized` always carries **both** locales; a missing translation fails the build (C-3).
- An entry with an `audience` uses `LocalizedFor`: the translation keys must equal the audience, so a pt-BR-only entry
  cannot be rendered in en-US by mistake (C-1).
- Plain text only. Rich text exists only in the legal Markdown files.
- `HttpsUrl` rejects `http:`, credentials in the URL and tracking parameters (`utm_*`, `fbclid`, `gclid`, `ref`).
- `Image.src` points to `src/assets/**`; formats webp, avif, jpg, png; at most 2 MB; `alt` required unless
  `decorative`.
- **Metadata is removed before the file is first committed, not after.** A published repository keeps every commit,
  so a check in CI alone is too late. Required: a repository script (`strip-metadata`, re-encodes without EXIF, GPS
  or other metadata) that the contributor runs before `git add`, wired as a local pre-commit hook that rejects staged
  images that still carry metadata; the original is never committed. CI repeats the check as a backstop and fails if
  any image in the tree carries metadata. The same rule covers every image (parts, team, logo, social card).
- Dates are `YYYY-MM-DD`. Dates are never shown on the member count (D-14); other dates are shown only where a
  section says so.
- Display of money: `Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL' })` from cents.

## 3. UI strings

`src/i18n/messages/pt-br.json` and `en-us.json` are flat JSON objects (dotted namespaces in the keys). `pt-br.json` is the
master: `src/i18n/index.ts` derives `Messages` and `MessageKey` from it. **Key parity is enforced twice**: a
compile-time assertion in `index.ts` (a missing or extra key in `en-us.json` is a type error) and a unit test in
`tests/i18n.test.ts`, so a JSON file that bypasses the type check still fails CI.

- Value is a `string`. Placeholders are `{name}`; a unit test checks both locales use the same placeholder set per
  key. A plural form (`{ one: string; other: string }`, selected with `Intl.PluralRules`) is allowed only when a
  message first needs it, together with the change to `t()` and the parity test.
- Required namespaces: `nav.*`, `selector.*`, `a11y.*`, `status.live`, `status.inDevelopment`, `status.comingSoon`,
  `meta.<routeKey>.title`, `meta.<routeKey>.description` (one pair per route key), `home.*`, `projects.*`,
  `servers.*`, `join.*`, `support.*`, `organization.*`, `team.*`, `legal.*`, `footer.*`, `notFound.*`, and `discord.*`
  (the `/discord` page: headings, the agreement label, the updated-date line; its `<head>` strings use the en-US
  values because the page is `<html lang="en-US">`). The join buttons on `/discord` take their label from
  `join-channels.yaml`, so no `discord.*` key names WhatsApp.
- **No key name mentions WhatsApp**, so the two locales always have the same key set (C-1). WhatsApp content comes
  from the `whatsapp` entry of `join-channels.yaml`, which has `audience: [pt-br]`. **One exception for text, not
  for keys:** the pt-BR **value** of `meta.join.description` may name WhatsApp, because it describes the join page,
  whose pt-BR content lists that channel. It is the only message allowed to, the en-US value of the same key must
  not (C-1 scan of the built en-US output), and no other key, in either locale, names WhatsApp in its value. The
  two values of that key therefore differ in content, as the join page does by audience (routing-locale section 1).
  The i18n test enforces the allowlist on the JSON files.
- A `t(locale, key, params)` helper returns the string; an unknown key is a type error, not a runtime fallback.

## 4. `site.yaml`

```yaml
origin: https://empirecommunity.org
organization: EmpireCommunity
currency: BRL
contact:
  general: contact@empirecommunity.org
  legal: legal@empirecommunity.org
links:
  discord: https://empirecommunity.org/discord      # literal; the only Discord link allowed on the site
  github: https://github.com/EmpireCommunity
  contributing: https://github.com/EmpireCommunity/.github/blob/main/CONTRIBUTING.md   # the organization's contribution guide, linked from Projects
  cloud: https://empirecommunity.cloud              # game-server status site; not up yet, so Organization shows its host without a link
discord:                                            # the one place the invite is defined (D-29)
  inviteCode: <approved invite code>                # 2 to 32 characters, letters, digits and hyphen
  guildId: "<server id>"                            # 17 to 20 digits, quoted so it stays a string
analytics:                                          # Cloudflare Web Analytics, manual snippet (D-52, routing-locale section 5)
  webAnalyticsToken: <32 hex characters>            # public: it is printed in the HTML, so it lives here and not in an environment variable
```

`links.discord` is a literal in the schema. `discord.inviteCode` and `discord.guildId` are the **only** place the
approved invite is defined **in this repository**: the `/discord` page ([routing-locale](routing-locale.md)) and the integrity
check read them. The Worker repository holds its own copy of the two public values, and a scheduled check compares them
([members-json](members-json.md) 2.6, D-55). A search over `src/` fails the build if any
Discord invite URL (`discord.gg/...`, `discord.com/invite/...`) or any other copy of the code appears. The built
`/discord` page is the one place an invite URL exists in `dist/`, and every join button elsewhere links to
`links.discord` (D-41), not to the invite.

## 5. `community.yaml`

```yaml
foundedYear: 2020                         # ILLUSTRATIVE; owner supplies, optional
purpose:                                  # owner is writing it; optional
  pt-br: ...
  en-us: ...
discord:
  membersBuiltIn: 880                     # required; the value the HTML and the origin members.json carry
whatsapp:                                 # pt-BR only; optional
  members: 100                            # ILLUSTRATIVE; manual, set by the owner
  asOf: 2026-11-08                        # review trail only, never displayed (D-14)
```

- `discord.membersBuiltIn`: integer 1 to 1,000,000, set from a verified reading (never invented). It feeds the HTML
  and `dist/data/members.json` (see members-json, section 4).
- `whatsapp` is read only by pt-BR pages. The build scan for C-1 also checks that no en-US output contains it. The
  build warns (not fails) if `asOf` is older than 180 days.
- Absent optional fields mean the section or line is not rendered.

## 6. `projects.yaml` (D-7)

```yaml
- id: empiremuse
  name: EmpireMuse                        # brand name, not translated
  kind: bot                               # bot | game-hosting | site | mod | infrastructure | tool
  status: live                            # live | in-development
  summary:
    pt-br: ...                            # max 160
    en-us: ...
  url: https://muse.empirecommunity.org   # only if status is live
  repo: EmpireCommunity/EmpireMuse        # only if the repository is public
  order: 10
```

- `url` is allowed **only** when `status: live` (D-7: link only what works today). `repo` is allowed only for a
  **public** repository; EmpireBot and other private repositories carry no `repo`.
- A separate CI job `verify-links` (network allowed) checks every `url` answers 2xx or 3xx and every `repo` is public
  through the GitHub API; it also covers C-2 for all external links. The offline build does not depend on the network.
- Sorted by `order`, then `name`. Status badge text comes from `status.*` messages. The color of a badge is a design
  decision (Vitral, impeccable).
- Which projects appear, and their statuses, is the owner's content. This contract does not decide them.

## 7. `game-servers.yaml`

```yaml
- id: minecraft
  name: Minecraft
  status: live                            # live | coming-soon
  summary: { pt-br: ..., en-us: ... }     # max 160
  howToJoin: { pt-br: ..., en-us: ... }   # max 200; required when live, forbidden otherwise
```

- Live today: Minecraft. Coming soon: Palworld, Project Zomboid, Factorio (owner's list).
- No server address, IP or port is published unless the owner approves it. Default: not in the schema (exposure and
  attack surface; live status belongs to `empirecommunity.cloud`, out of scope).
- The sentence about requesting games ("on Discord or WhatsApp", en-US "on Discord") is built from the
  `join-channels` entries and `join.*` messages, not hardcoded.

## 8. `join-channels.yaml` (D-3)

```yaml
- id: discord
  url: https://empirecommunity.org/discord        # must equal site.yaml links.discord
  audience: [pt-br, en-us]
  label: { pt-br: Discord, en-us: Discord }
  description: { pt-br: ..., en-us: ... }          # max 200
- id: whatsapp
  url: https://chat.whatsapp.com/GfCtl35a7MwKfDvI1MzK8n
  audience: [pt-br]
  label: { pt-br: WhatsApp }
  description: { pt-br: ... }
```

- Rules: `discord` audience is both locales; `whatsapp` audience is exactly `[pt-br]` and its `url` is the community
  link from EMPIRECOMMUNITY.md. A channel is rendered in a locale only if the locale is in its `audience`.
- **Where each link goes (D-41).** Every join button on a locale page (home, join, game servers, footer) links to
  `links.discord`, whichever channel it names: the destination is the `/discord` page, where the visitor reads the
  rules and ticks the box before the real links appear. The `discord` entry's `url` is therefore the page address, as
  before. The `whatsapp` entry's `url` (the community link, D-37) is **read only by the `/discord` page**, inside its pt-BR
  container; no other page, component, head tag or data file renders it, and no other application source holds it
  (`src/` outside `join-channels.yaml`, and `scripts/`). Documentation examples, such as the one above, are not
  sources and may show it; in `dist/` it appears only on `/discord` (section 12). That is its one source. The Discord invite has one source too (`site.yaml`, section 4). Whether the
  pt-BR join page shows one button or one per channel is a layout choice (Bússola); either way every `href` is
  `links.discord`.
- Equal weight in pt-BR (D-3): the two channels share the same component, size, and prominence, Discord first, then the
  others by id. Visual treatment is Vitral's.
- WhatsApp never appears in en-US output, including head tags, JSON-LD, sitemap and `llms.txt` (post-build scan). On
  `/discord`, a neutral page, it appears only inside the `lang="pt-BR"` container (section 12).

## 9. `team.yaml` (personal data, High)

```yaml
- id: p-3f9a1c7d2b40                     # opaque random id (PersonId); never a name, nickname or e-mail
  isFounder: true                         # optional, default false; at most one entry; shown in the Founder block, the others in Team
  name: ...                               # optional; allowed ONLY if consent.scope contains name
  nickname: ...                           # optional; allowed ONLY if consent.scope contains nickname
  role: { pt-br: Fundador, en-us: Founder }
  bio: { pt-br: ..., en-us: ... }         # optional, max 240
  photo: { src: ../assets/team/p-3f9a1c7d2b40.webp, alt: { pt-br: ..., en-us: ... } }   # optional; file named by the opaque id
  links:                                  # optional
    - { kind: github, url: https://github.com/... }
  consent:                                # REQUIRED, no default
    given: true                           # literal true
    isAdult: true                         # literal true
    recordedOn: 2026-11-10                # ILLUSTRATIVE
    evidenceRef: CONS-0001                # id of the private record kept outside the repository
    scope: [nickname, role, bio, photo, links]   # what the person agreed to publish
    historyNoticeGiven: true              # the person was told removal does not erase public git history
    reviewOn: 2027-11-10                  # yearly review date
```

- **The build fails** if an entry has no `consent`, `given` or `isAdult` is not `true`, `evidenceRef` or
  `recordedOn` is missing, or `historyNoticeGiven` is not `true` (C-4).
- **Opaque identity.** `id` and the photo file name are random and carry no personal data (they are permanent in the
  public history). The person's `name` and `nickname` are separate optional fields.
- **Nickname-only consent works.** The renderer shows **only** the fields listed in `consent.scope`. A field present
  in the entry but absent from `scope` fails the build, so data cannot ride along unconsented; in particular `name` is
  rejected unless `scope` contains `name`. `scope` must contain `name` or `nickname`. Free text of a nickname-only
  person (`role`, `bio`, `alt`) must not contain the real name; this is a review item for every change to this file.
- **Dist without a consent block is impossible.** Team data is read only through one module that returns validated
  entries; the build fails before emitting anything if one entry is invalid. A post-build check also fails if `dist/`
  contains a person marker (`data-person-id`) with no valid entry, any `name` or `nickname` string of `team.yaml`
  outside such a marker, or a team image not referenced by a validated entry. The runtime image contains `dist/`
  only, never `src/`.
- `evidenceRef` is an opaque reference; the consent record itself (and any personal contact data) lives outside the
  repository, with the owner. The repository must never hold ID documents, addresses, phone numbers or e-mails of
  team members.
- A warning (not a failure) is raised when `reviewOn` is in the past.
- Photos: metadata removed before the first commit (section 2), real `alt`, no photo of anyone not in the list.
- More than one entry with `isFounder: true` fails the build. The Organization page shows the founder entry in its
  Founder block and the rest in Team; an empty block is not rendered.
- Nothing is rendered about the team if the collection is empty.

### 9.1 Withdrawal runbook (consent withdrawn or data removal requested)

Deadlines are targets proposed here; **the owner confirms them with the legal review** (depends on the owner).
Target: live removal within 72 hours of a valid request, and purge of published artifacts within 7 days.

1. Receive the request at the legal contact address; record it in the private register (outside the repository) with
   the date; acknowledge it to the requester.
2. Open a pull request that removes the entry, the photo file and any mention elsewhere (other data files, legal
   text). It follows the normal PR-only merge path with the required checks; it is prioritized, not skipped.
3. Merge, publish and deploy the new image by digest, with the owner's approval as for any deploy ([deploy](deploy.md)).
4. **Test on the new digest:** run, locally by the owner or Guindaste, a search of the new image's served files and of
   `dist/` for the person's name, nickname, photo file name and photo content hash. The search terms come from the
   private register; they are never written to the repository, to workflow inputs or to CI logs. The test passes only
   with zero matches.
5. Purge the Cloudflare cache for the affected pages and image URLs.
6. **Delete the affected Docker Hub tags** (`empirecommunity/empirecommunity-site-org`) published before the removal that still contain the data (they are public). Delete tags or manifests one by one (Docker Hub Tags or Image Management tab, or the tag-delete API); **never delete the repository**, which would also delete the clean image deployed in step 3 and every rollback image. If a tag is immutable, it cannot be deleted until an admin makes it mutable ([release runbook](../runbook/release.md#purging-an-affected-tag)).
   Docker's docs do not say whether a deleted tag's digest stays pullable until garbage collection, so check by anonymous pull (`docker logout`) of **each** affected digest. The request stays **open** until every affected digest has a confirmed removal: a pull that fails with a rate limit (429) or a service error (5xx) is inconclusive, and so is waiting on the owner or Docker support. Then confirm that the clean digest from step 3 still pulls.
   After this step a rollback may only target a version that does not contain it.
7. Git history and forks: the entry remains in the commit history and in any clone or fork already made; the person
   was told so beforehand (`historyNoticeGiven`). Rewriting history is **not** the default; it needs the owner's
   explicit OK and is never a force-push to `main` without that OK.
8. Close the request in the private register with the completion dates and answer the requester.

## 10. `support.yaml` and the support module (Medium at launch; D-6, D-21, D-22, D-28)

**At launch the site receives no money and shows no way to send any (D-28).** The Support page shows the community
goal, the server parts and a plain "donations are not open yet" state. Opening donations, the payment gateway, the
transparency panel and anything about a ledger are a **later contract**, written after the site launches and subject
to its own threat model and legal review. This document designs none of them, and nothing in it may be read as a
payment instruction.

The Support page reads **only** `getSupport()` from `src/lib/support.ts`, never the YAML. The module loads
`support.yaml`, validates it and derives the totals. It holds no payment, account or donor data of any kind.

```ts
type SupportSnapshot = {
  donations: { status: 'not-open' };
  goal: { id: string; title: Localized; description: Localized; targetCents: number;
          securedCents: number; remainingCents: number; progress: number /* 0..1 */ };
  specs: { label: Localized; value: string }[];                  // optional highlights, e.g. RAM
  parts: Part[];
  partDonations: { accepted: boolean; how: Localized } | null;
};
```

`support.yaml`:

```yaml
schemaVersion: 1
verified: { on: 2026-11-11, by: owner }       # REQUIRED; review trail, not displayed
donations:
  status: not-open                             # the only value schema version 1 accepts (D-28)
goal:
  id: xeon-server
  title: { pt-br: ..., en-us: ... }
  description: { pt-br: ..., en-us: ... }
  targetCents: 538499                          # R$ 5,384.99, the first milestone (D-6, D-22, D-62)
specs:                                         # optional
  - { label: { pt-br: Memória RAM, en-us: RAM }, value: 128 GB }
parts:
  - id: example-part
    name: { pt-br: ..., en-us: ... }
    category: memory                           # cpu | memory | storage | motherboard | cooling | psu | chassis | network | other
    quantity: 1                                # integer 1 to 99
    unitPriceCents: 0
    status: needed                             # needed | purchased | donated
    # acquiredOn: 2026-11-10                   # required iff purchased or donated, forbidden if needed (a needed part has none)
    photo: { src: ../assets/xeon/part.jpg, alt: { pt-br: ..., en-us: ... } }   # optional
partDonations:                                 # optional; a physical part, not money
  accepted: true
  how: { pt-br: ..., en-us: ... }              # route to offer a part (Discord or e-mail), max 200
```

Rules:

- **Money:** integer cents only (`Cents`). Derived at load, never stored: `securedCents = sum(quantity * unitPriceCents)`
  over parts with status `purchased` or `donated`; `remainingCents = max(0, targetCents - securedCents)`;
  `progress = min(1, securedCents / targetCents)`. `targetCents` is greater than 0. Currency is BRL (site.yaml).
  `quantity` is an integer from 1 to 99.
- **Donations state.** `donations.status` is the literal `not-open`; any other value fails the build with the message
  that donations are opened by a later contract. The schema is **strict**: an unknown key (`pix`, a gateway or payment
  field, a recipient) fails the build, so payment data cannot enter the file without changing this contract. The
  Support page renders one block marked `data-donations="not-open"` with the message `support.donations.notOpen`
  (required in both locales). The message says that donations are not open yet; it gives **no payment instruction, no
  account data and no link to a payment provider**. No other page, `llms.txt` or structured data states or suggests
  that a donation can be made now; that part is a human review of the copy in the PR.
- **Goal is a milestone, not an end (D-22).** Reaching it (`remainingCents` is 0) switches the progress text to the
  required message `support.goal.reached`; nothing is hidden, closed or marked as complete. Ongoing community costs
  (power, upgrades, hosting, domains) are part of the same later donation contract.
- **Progress criterion.** The required message `support.progress.criterion` (both locales) states that the progress
  counts the value of parts already acquired, bought or donated, not money received.
- **Payment guard (build and CI).** The build fails if the content files or `dist/` contain: the attribute `data-pix`;
  a payment-provider host or short link (`mercadopago`, `mpago.la`); the Pix BR Code marker `br.gov.bcb.pix` (case-insensitive); a string
  shaped like a random Pix key (UUID) or a CNPJ; or an e-mail address outside the `site.yaml` contact allowlist. The
  word "Pix" and "Mercado Pago" in any page text are reported as a **warning** with their locations, for the PR
  reviewer to confirm they do not suggest a donation can be made now. The scheduled integrity check applies the same
  rules to the delivered pages ([deploy](deploy.md) section 8).
- **No analytics beacon on the support pages**, and their CSP omits the Cloudflare analytics hosts (routing-locale
  section 6); Cloudflare HTML-rewriting features are off site-wide (routing-locale section 5). This setting is kept
  from launch so that the later donation contract starts from the strict baseline; any change to it belongs to that
  contract.
- **No payment or donor data anywhere:** no keys, accounts, donor names, amounts per person, receipts or messages.
- **Verification:** `verified.on` and `verified.by` are required (never publish unverified data). A warning is raised
  when `verified.on` is older than 90 days. Neither is displayed.
- **Change control (public repository):** every change to any path reaches `main` only through a pull request, with
  the required status checks of [deploy](deploy.md) passing, and with no direct or force push to `main`. A
  `CODEOWNERS` file naming the owner for the whole tree is kept for future use; **no approval count is specified**
  (D-17). Compensating controls: the payment guard above, the scheduled integrity check, and the owner's strong
  authentication on the accounts involved. Residual risk is accepted by the owner.
- **Part donations are not money.** `partDonations` is the route to offer a physical part (Discord or e-mail) and
  **stays available at launch by default**, because a physical part handles no money. The owner can reverse this by
  setting `accepted: false` or omitting the key. Part photos and `alt` follow
  section 2. Part names are Localized; `acquiredOn` is not displayed unless the owner asks.
- The page shows: goal title and description, progress (secured of target), parts with status, what was bought, part
  donation route (if shown), and the donations-not-open block. Same content in both locales (C-3).

## 11. Legal pages (Terms and Privacy)

Files `src/content/legal/<locale>/<slug>.md`, slug `terms-of-service` or `privacy-policy`.

```yaml
---
title: ...
slug: terms-of-service          # must equal the file name
locale: pt-br                   # must equal the folder
version: "1.0"                  # identical in both locales
effectiveDate: 2026-12-01       # identical in both locales
---
```

- Both locales exist for both slugs (C-3). **Headings carry explicit ids** (`## Controller {#controller}`); the build
  fails unless both locales have the same heading ids in the same order, the same `version` and the same
  `effectiveDate`. Semantic equality of the text ("identical content in both languages") is a human review in the PR
  with the owner as required reviewer; it cannot be automated.
- Rendered with `version` and `effectiveDate` visible. Markdown is rendered **without raw HTML** (parser option),
  and a fixture test with an embedded `<script>` proves it is escaped or dropped.
- **Logs (D-20).** The site keeps **no access log at the origin** and only a minimal, short-rotated error log (see
  ADR-0001 and routing-locale section 6). The Privacy text must say exactly that and must not promise a fixed
  retention period for access logs, and no contract for this site may state one. This was decided by the owner
  (D-20), and a legal review of the log-keeping obligations that may apply to the site (Marco Civil da Internet) is to be done before
  donations open (D-28; depends on the owner).
- Other processors keep their own records outside this site's control (Cloudflare for the connection, the edge proxy
  layer in front of the origin); the Privacy text says so plainly without describing their internals.
- Content requirements for the drafter (the drafter is not the architect and the owner is not a lawyer, so Regente
  explains in plain language): contacts, forum Goiânia-GO, LGPD and Marco Civil da Internet, what the site collects (no
  accounts, no forms, no cookies set by the site, no access log at the origin), Cloudflare as processor of the
  connection (CDN, country detection at the edge for the language redirect, Web Analytics on the pages that carry it),
  a generic clause that external services linked from the site have their own terms and privacy policies, how to ask
  for removal of personal data, and the team member consent and the public git history notice.
- **The legal text does not name WhatsApp** (Regente ruling). The two locales carry identical content and WhatsApp
  appears only in pt-BR (C-1), so any WhatsApp mention would break one of the two rules. External services are
  covered by the generic clause above; Discord may be named because it is offered in both locales. The C-1 scan
  covers `src/content/legal/**` and, in the built legal pages of both locales, the `<main>` element only: the legal
  text itself, not the shared site footer or header, which the pt-BR pages may use to list WhatsApp. The en-US pages
  stay covered whole by the en-US rule below.
- **Controller identification (D-23).** The controller is the owner as a natural person. The Privacy text shows the
  legal name and a contact e-mail address **only**; the owner supplies both in the pull request for the text, and the
  legal name may differ from the public name used elsewhere on the site. The **tax identification is never written in
  the repository, in a note or in a message, and the text does not print it.** Publishing the Privacy page waits for
  the owner to supply the name and the e-mail (depends on the owner).
- **No payments at launch (D-28).** The Privacy and Terms texts at launch do not describe donations, a payment
  provider or payment data, because the site neither receives money nor offers a way to send it. The later donation
  contract updates both texts, with a new `version` and `effectiveDate`, before donations open.
- Cloudflare Web Analytics is described as cookieless by Cloudflare; the drafter confirms the statement against
  Cloudflare's current documentation before publishing (not verified here).
- JSON-LD and any other JSON embedded in HTML is serialized with `<`, `>`, `&`, U+2028 and U+2029 escaped; a fixture
  test with such characters in a field proves the output cannot close the script element.

## 12. Build and CI checks (summary)

| Check | Fails build | Ref |
|---|---|---|
| Zod validation of every file above | yes | all |
| `Localized` complete, `audience` keys exact, `pt-br`/`en-us` message type parity and placeholder parity | yes | C-3 |
| Route keys exist in both locales | yes | C-3 |
| Team consent rules, empty collections not rendered | yes | C-4 |
| WhatsApp absent from en-US output, `llms.txt`, root page **and from the legal Markdown and the `<main>` element of the built legal pages in both locales** (the legal text, not the shared footer, which lists WhatsApp in pt-BR; en-US pages are scanned whole by the en-US rule; scope otherwise unchanged by D-41); only `https://empirecommunity.org/discord` as Discord link; in `dist/` the invite URL appears only in `discord/index.html` and only with the configured code (it may appear once per language container). **Terms URL exception:** the exact string `https://discord.com/terms` (rule 5, section 14) is accepted only as text content, never inside an attribute, only in `discord/index.html`, and at most once per language container; it is rejected in any attribute and on every other page, and every other Discord URL on any page still fails; the WhatsApp community URL appears in `dist/` only in `discord/index.html`, only once, only as `join-channels.yaml` defines it, and no WhatsApp reference there has a nearest ancestor `lang` other than `pt-BR` or sits in the `<head>` | yes | C-1 |
| `/discord` page structure (D-41): `<html lang="en-US">`; exactly two language containers; one checkbox per container (no `name`, `autocomplete="off"`, a matching `<label for>`) followed by that container's join links; the en-US container has the Discord link and no WhatsApp; the pt-BR container has the Discord and the WhatsApp link; no `<script>`, `<form>`, `<noscript>`, `style=` or `http-equiv="refresh"`; `noindex`; rules text and `updatedOn` rendered from `community-rules.yaml`; absent from the sitemap. Blocking from the PR that builds the page: until then it only warns through `PENDING.discordPage` ([deploy](deploy.md)) | yes | C-1, C-5 |
| Legal parity (ids, version, effective date) | yes | C-3 |
| No inline executable script or `style=` in built HTML; inline `ld+json` allowed | yes | C-5 |
| `hreflang` reciprocity, sitemap content, canonical present | yes | C-5 |
| Images: metadata absent (backstop; the primary control is the pre-commit step), size, alt | yes | privacy |
| Team: opaque ids, scope rules, `dist` person markers and team images only from validated entries | yes | C-4, privacy |
| Support: strict keys, `donations.status` is `not-open`, cents, derived totals, `verified` present, required messages (`support.donations.notOpen`, `support.goal.reached`, `support.progress.criterion`), payment guard on sources and `dist/` (section 10) | yes | money |
| Legal Markdown has no raw HTML; JSON-LD escaping fixtures | yes | security |
| `verify-links`: external URLs answer, repos public (network job) | yes in CI, not in local build | C-2 |
| Stale `whatsapp.asOf`, `verified.on`, `reviewOn`; the words "Pix" or "Mercado Pago" in page text | warning | review |

## 13. Open questions (content, none blocks implementation)

1. Donations (gateway, transparency panel, ledger): **not a launch question**. A later contract after the site launches
   (D-28); it also takes the accountant guidance and the legal review (D-26).
2. Xeon parts, prices, what was bought, photos (owner).
3. Team: members, nicknames, roles and consent records (owner).
4. Projects list and statuses for each of the Empire projects (owner confirms; EmpireBot and EmpireHub are not live).
5. Publish game server addresses? Default no.
6. GitHub activity as a credibility item: source not decided (build-time public data or static).
7. Year the community started and its purpose text (owner is writing).
8. The community rules text in both languages for `community-rules.yaml` (the text valid on 2025-02-27; the en-US
   version is owner or Bússola content, never invented here). The rules cannot name WhatsApp (section 14); if the
   owner's text does, Regente decides where that wording goes.
9. Depends on the owner: legal name and contact e-mail for the Privacy page (section 11, D-23); withdrawal deadlines
   (9.1); confirming the approved invite code (section 4); strong authentication on the accounts involved; the legal review
   of log obligations before donations open.

## 14. `community-rules.yaml` (D-41)

The text and the date shown on the `/discord` page ([routing-locale](routing-locale.md)). One document, optional until
the owner supplies the rules (the page is not built without it, so `PENDING.discordPage` stays true), validated whenever
the file exists, and **required once that flag is false**. It is the **one source** of the rules text and of the "last
updated" date; no other file holds either.

```yaml
updatedOn: 2025-02-27                     # IsoDate; when the rules text last changed (shown on /discord, formatted per locale)
intro: { pt-br: ..., en-us: ... }         # optional, max 400
rules:                                    # 1 to 40 entries, shown in file order
  - id: respect                           # Id, unique, never renamed
    title: { pt-br: ..., en-us: ... }     # max 80
    body: { pt-br: ..., en-us: ... }      # max 600; a newline is a line break, not markup
closing: { pt-br: ..., en-us: ... }       # optional, max 200; the final sentence of the rules (copy key rules.closing)
```

- Strict keys. `Localized` on every text, so a missing translation fails the build (C-3). Plain text only (`Text`
  rule, no markup): the page renders it as text, never as HTML.
- **Plain-text address.** A rule may carry an address inside its `body` (rule 5 carries `https://discord.com/terms`).
  It is text: there is no `url` field, the page renders no link or autolink for it, and it is not in an `href`. It is
  written exactly as `https://discord.com/terms`, with no trailing punctuation (the scan's URL match would take a
  trailing character into the URL and fail the page). The Discord URL scan accepts it under the **Terms URL
  exception** of the section 12 C-1 row (text only, `/discord` only); any other Discord URL in the rules text fails the
  build. The `src/` invite search of section 4 matches invite URLs only, so this address does not trigger it.
- **No text names WhatsApp, in either locale** (a schema refinement), for the reason the legal text does not
  (section 11): the two locales carry identical content and WhatsApp appears only in pt-BR (C-1).
- `updatedOn` changes only when the rules text changes, in the same pull request. The page shows this date, not a build
  date. It is the date of the rules, and the project does not claim it is verified against the server's own rules
  channel; the owner is the source for both.
- The page shows the date because this section says so (section 2: other dates are shown only where a section says
  so). A stale-date warning is not defined: an old date is normal for rules that rarely change.
