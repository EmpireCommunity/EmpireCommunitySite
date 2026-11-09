# Contract: site data and content schemas

- Version: 1. Owner: Alicerce. Consumers: Vitral (pages and components), Forja (loaders, build checks, CI), Ensaio
  (C-1 to C-4), Sentinela (money and personal data surfaces), Regente (content intake from the owner).
- Decisions: D-2, D-3, D-5, D-6, D-7, D-14, D-16. Stack: [ADR-0001](../adr/0001-stack.md). Routes and locales:
  [routing-locale](routing-locale.md). Member count endpoint: [members-json](members-json.md).
- Risk: **High** for `support.yaml` (money, a public payment key) and `team.yaml` (personal data). The other files are
  Low or Medium.
- Examples below are **illustrative placeholders**, not facts. Real values come from the owner; nothing is invented
  and a section with no real data is not rendered (C-4).

## 1. Layout

```
src/
  content.config.ts            # collections and Zod schemas below (Zod as exposed by Astro)
  i18n/messages/pt-br.ts       # master locale for UI strings
  i18n/messages/en-us.ts       # must satisfy the type of pt-br.ts
  data/site.yaml               # one document
  data/community.yaml          # one document
  data/projects.yaml           # collection
  data/game-servers.yaml       # collection
  data/join-channels.yaml      # collection
  data/team.yaml               # collection
  data/support.yaml            # one document, read only through src/lib/support.ts
  content/legal/pt-br/terms-of-service.md   privacy-policy.md
  content/legal/en-us/terms-of-service.md   privacy-policy.md
  lib/routes.ts  lib/members.ts  lib/support.ts
  assets/                      # images referenced by data files
```

Collections use Astro's `file()` loader; one-document files are parsed with the same Zod schemas by a small loader.
**Any schema error fails the build** with the file, the entry id and the field.

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

`src/i18n/messages/pt-br.ts` exports a `const` object (flat keys with dotted namespaces) and its type `Messages`.
`en-us.ts` is declared `satisfies Messages` with the same keys, so a missing or extra key is a type error.

- Value is `string` or `{ one: string; other: string }` (selected with `Intl.PluralRules`). Placeholders are
  `{name}`; a unit test checks both locales use the same placeholder set per key.
- Required namespaces: `nav.*`, `selector.*`, `a11y.*`, `status.live`, `status.inDevelopment`, `status.comingSoon`,
  `meta.<routeKey>.title`, `meta.<routeKey>.description` (one pair per route key), `home.*`, `projects.*`,
  `servers.*`, `join.*`, `support.*`, `organization.*`, `team.*`, `legal.*`, `footer.*`, `notFound.*`.
- **No key mentions WhatsApp.** WhatsApp text comes from the `whatsapp` entry of `join-channels.yaml`, which has
  `audience: [pt-br]`.
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
```

`links.discord` is a literal in the schema. A search over `src/` fails the build if any other Discord invite URL
(`discord.gg/...`, `discord.com/invite/...`) appears.

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

- Rules: `discord` audience is both locales; `whatsapp` audience is exactly `[pt-br]` and its `url` is the group
  link from EMPIRECOMMUNITY.md. A channel is rendered in a locale only if the locale is in its `audience`.
- Equal weight in pt-BR (D-3): the two channels share the same component, size, and prominence, ordered by the order
  in this file. Visual treatment is Vitral's.
- WhatsApp never appears in en-US output, including head tags, JSON-LD, sitemap and `llms.txt` (post-build scan).

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
6. **Delete the GHCR package versions** published before the removal that still contain the data (they are public).
   After this step a rollback may only target a version that does not contain it.
7. Git history and forks: the entry remains in the commit history and in any clone or fork already made; the person
   was told so beforehand (`historyNoticeGiven`). Rewriting history is **not** the default; it needs the owner's
   explicit OK and is never a force-push to `main` without that OK.
8. Close the request in the private register with the completion dates and answer the requester.

## 10. `support.yaml` and the support module (money, High; D-6, D-16)

The Support page reads **only** `getSupport()` from `src/lib/support.ts`, never the YAML. Today the data comes from
`support.yaml`; a payment gateway (D-16, out of this delivery) would replace the implementation behind the same
function and type, with no change in components.

```ts
interface SupportSource { load(): Promise<SupportSnapshot> }   // today: FileSupportSource (support.yaml)
type SupportSnapshot = {
  goal: { id: string; title: Localized; description: Localized; targetCents: number;
          securedCents: number; remainingCents: number; progress: number /* 0..1 */ };
  specs: { label: Localized; value: string }[];                  // optional highlights, e.g. RAM
  pix: PixKey | null;
  parts: Part[];
  partDonations: { accepted: boolean; how: Localized } | null;
  source: 'file';                                                // 'gateway' later
};
```

`support.yaml`:

```yaml
schemaVersion: 1
verified: { on: 2026-11-10, by: owner }       # REQUIRED; review trail, not displayed
goal:
  id: xeon-server
  title: { pt-br: ..., en-us: ... }
  description: { pt-br: ..., en-us: ... }
  targetCents: 300000                          # R$ 3,000.00 (D-6)
specs:                                         # optional
  - { label: { pt-br: Memória RAM, en-us: RAM }, value: 128 GB }
pix:                                           # optional; section hidden if absent
  keyType: random                              # random | email | cnpj
  key: <the real key, supplied by the owner>   # placeholders are rejected by the build (rules below)
  recipientName: <name as the bank shows it>   # 3 to 60 characters, required
  showWhenGoalMet: false                       # optional; owner decision, see rules
parts:
  - id: example-part
    name: { pt-br: ..., en-us: ... }
    category: memory                           # cpu | memory | storage | motherboard | cooling | psu | chassis | network | other
    quantity: 1                                # integer 1 to 99
    unitPriceCents: 0
    status: needed                             # needed | purchased | donated
    acquiredOn: 2026-11-10                     # required iff purchased or donated, forbidden if needed
    photo: { src: ../assets/xeon/part.jpg, alt: { pt-br: ..., en-us: ... } }   # optional
partDonations:
  accepted: true
  how: { pt-br: ..., en-us: ... }              # route to offer a part (Discord or e-mail), max 200
```

Rules:

- **Money:** integer cents only (`Cents`). Derived at load, never stored: `securedCents = sum(quantity * unitPriceCents)`
  over parts with status `purchased` or `donated`; `remainingCents = max(0, targetCents - securedCents)`;
  `progress = min(1, securedCents / targetCents)`. `targetCents` is greater than 0. Currency is BRL (site.yaml).
- **Pix key:** `keyType` is `random`, `email` or `cnpj`. `cpf` and `phone` are not in the enum, so they cannot be
  published (personal data). Validation by type, and **placeholders are rejected**: `random` must be a UUID v4
  (version and variant bits correct) with at least 8 distinct hex digits and not on a denylist of obvious fillers;
  `email` must not use `example.*`, `.test`, `.invalid`, `.local` or similar; `cnpj` must have valid check digits and
  not be a repeated digit. `recipientName` is required (3 to 60 characters), no placeholder text, and is what the
  bank shows (the owner decides whether that is a person or an organization). `quantity` is an integer from 1 to 99.
- **The key reaches the page in one place only.** It is rendered as text with a copy control inside one element marked
  `data-pix`, byte-identical to the YAML value. A post-build scan fails if the exact key, or anything matching the
  UUID or CNPJ key patterns, appears in `dist/` outside that element, if an e-mail address outside the `site.yaml`
  contact allowlist appears, or if the key in the element differs from the YAML. A QR code, if shown, is **generated
  at build time by repository code from the validated key** (its payload checksum is validated); an uploaded QR image
  is not accepted by the schema.
- **Donor safeguards in the text.** Messages `support.pix.checkRecipient` (tells donors to check the recipient name in
  their bank app before confirming) and `support.progress.criterion` (states that the progress counts the value of
  parts already acquired, bought or donated, not money received) are required in both locales and rendered on the
  page. The owner also pins the key on the official Discord as an independent reference (depends on the owner).
- **Goal met.** When `remainingCents` is 0 the Pix block is hidden, unless the owner sets `pix.showWhenGoalMet: true`
  (owner decision).
- **No analytics beacon on the support pages**, and their CSP omits the Cloudflare analytics hosts (routing-locale
  section 6); Cloudflare HTML-rewriting features are off site-wide (routing-locale section 5) so the key is delivered
  exactly as built.
- **No donor data anywhere:** no donor names, amounts per person, receipts or messages. If the gateway stores receipts
  later, that is its own contract and plan (D-16).
- **Verification:** `verified.on` and `verified.by` are required (never publish unverified data). A warning is raised
  when `verified.on` is older than 90 days. Neither is displayed.
- **Change control (public repository, High risk files):** every change to any path reaches `main` only through a
  pull request, with the required status checks of [deploy](deploy.md) passing, and with no direct or force push to
  `main`. A `CODEOWNERS` file naming the owner for the whole tree is kept for future use; **no approval count is
  specified** (D-17). Compensating controls: the published Pix key is compared with `support.yaml` by the scheduled
  integrity check ([deploy](deploy.md) section 8); the key is pinned on the official Discord; donors are told to check
  the recipient name; the owner uses strong authentication on the accounts involved. Residual risk is accepted by the
  owner.
- Part photos and `alt` follow section 2. Part names are Localized; `acquiredOn` is not displayed unless the owner
  asks.
- The page shows: goal title and description, progress (secured of target), parts with status, what was bought, part
  donation route, Pix block. Same content in both locales (C-3).

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
  donations are enabled (depends on the owner).
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
  covers `src/content/legal/**` and the built legal pages in both locales.
- **Controller identification (depends on the owner and a lawyer).** The text must identify a controller that is a
  natural or legal person; "the administrative team" alone is not enough for LGPD. Which person or entity, and its
  tax identification if one exists, is an owner decision (P-11); until then this item stays open and blocks
  publishing the Privacy page.
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
| WhatsApp absent from en-US output, `llms.txt`, root page **and from the legal Markdown and built legal pages in both locales**; only `https://empirecommunity.org/discord` as Discord link | yes | C-1 |
| Legal parity (ids, version, effective date) | yes | C-3 |
| No inline executable script or `style=` in built HTML; inline `ld+json` allowed | yes | C-5 |
| `hreflang` reciprocity, sitemap content, canonical present | yes | C-5 |
| Images: metadata absent (backstop; the primary control is the pre-commit step), size, alt | yes | privacy |
| Team: opaque ids, scope rules, `dist` person markers and team images only from validated entries | yes | C-4, privacy |
| Support: Pix type and placeholder rules, cents, derived totals, `verified` present, key only inside `data-pix` and equal to the YAML, required donor messages | yes | High |
| Legal Markdown has no raw HTML; JSON-LD escaping fixtures | yes | security |
| `verify-links`: external URLs answer, repos public (network job) | yes in CI, not in local build | C-2 |
| Stale `whatsapp.asOf`, `verified.on`, `reviewOn` | warning | review |

## 13. Open questions (content, none blocks implementation)

1. Pix: key, type and `recipientName` (owner). Whether the recipient is a person or an organization.
2. Xeon parts, prices, what was bought, photos (owner).
3. Team: members, nicknames, roles and consent records (owner).
4. Projects list and statuses for each of the Empire projects (owner confirms; EmpireBot and EmpireHub are not live).
5. Publish game server addresses? Default no.
6. GitHub activity as a credibility item: source not decided (build-time public data or static).
7. Year the community started and its purpose text (owner is writing).
8. Depends on the owner: controller identity for the Privacy page (section 11); withdrawal deadlines (9.1); whether
   the Pix block stays visible after the goal is met (`showWhenGoalMet`); pinning the key on the official Discord;
   strong authentication on the accounts involved; the legal review of log obligations before donations are enabled.
