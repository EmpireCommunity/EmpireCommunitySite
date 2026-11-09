# AGENTS.md

Rules for any human or agent working in this repository. Stack and contracts: `docs/adr/0001-stack.md`,
`docs/contracts/`, `PRODUCT.md`.

## Git and worktrees (owner decision D-24)

- The repository root stays on `main`. **Never write there**: no edits, no commits, no checkouts.
- Work in a worktree created from the root, one per branch:
  `git worktree add worktrees/<type>-<name> -b <type>/<name> <base>`.
  The `worktrees/` folder is ignored by git and by Docker.
- Branch names are `type/short-name`. Commits follow Conventional Commits
  (`feat fix docs style refactor perf test build ci chore revert`, optional scope).
- Never push to `main`, never force-push, never rewrite shared history. Pushing a branch, opening PRs and merging
  have the owner's standing OK (D-31); releases, deploys and GitHub settings still need the owner's explicit OK each time.
- Run `gitleaks git --pre-commit --staged --redact` before every commit. Never commit secrets or `.env` files
  (use `.env.example`).
- **`.maestri/` is never committed.** It holds agent workspace data. It is in `.gitignore` and `.dockerignore`.

## Stack rules

- Astro 7 static (`output: 'static'`), TypeScript strict, Tailwind 4 with tokens in `@theme`
  (`src/styles/global.css`). **No React** or any other UI runtime.
- **pnpm only**, lockfile committed, `--frozen-lockfile` in CI and Docker. Node 24 LTS (`.nvmrc`, `engines`).
  Lifecycle scripts only for the `allowBuilds` list in `pnpm-workspace.yaml`.
- Before adding a package, check license and maintenance and prefer none. Every dependency is a `devDependency`
  (the shipped artifact is static files).
- **No color value outside the `@theme` block.** Components use tokens (`bg-verde-ata`, `var(--color-papel)`).
- URLs live in `src/lib/routes.ts`; nothing else hardcodes a path. UI strings are in
  `src/i18n/messages/*.json` and the two locales must have the same keys.
- No inline `<script>` or `style=` in pages (strict CSP, `routing-locale.md` section 6).
- Content schemas are in `src/schemas/`, wired in `src/content.config.ts`. A schema error fails the build.

## Commands

```
pnpm install --frozen-lockfile
pnpm dev | pnpm build | pnpm check (astro check) | pnpm lint | pnpm test
```

## Risk map (task level follows the riskiest file touched)

| Level | Paths and changes |
|---|---|
| **High** | Personal data: `src/data/team.yaml`, `src/schemas/team.ts`, `src/lib/team.ts`, team images. Money and donations: any support, donation or payment code and data. Secrets and tokens. Deploy, CI and supply chain: `.github/`, `Dockerfile`, `deploy/`, `worker/`, `package.json` dependencies, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.dockerignore`. Legal text with controller or data-handling claims. |
| **Medium** | Bug fixes and behavior changes: `src/schemas/` (other than team), `src/content.config.ts`, `src/lib/`, `src/i18n/index.ts`, `astro.config.ts`, routing and locale rules, head tags. |
| **Low** | Copy and translations, styling and tokens, assets, docs, version bumps. |

High risk needs a short contract, a threat model on the sensitive surface, tests on the risky paths and one
review each (architecture, tests, security) on the final commit. Donations are not open at launch: do not add
any Pix or receiving-money schema until the donation contract exists.

## Data rules that are easy to break

- Nothing is invented: a section with no real data is not rendered. Numbers, links and people come from the owner.
- A person appears only with a recorded consent; every field must be listed in `consent.scope`.
- WhatsApp never appears in en-US output; the only Discord link is `https://empirecommunity.org/discord`.
- Images are stripped of metadata before their first commit.
