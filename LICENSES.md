# Third-party licenses

The site code is MIT (see `LICENSE`). This file records the origin and license of everything we ship that we did not write.

## Fonts

Self-hosted, `latin` subset, variable, upright only, used exactly as the Fontsource packages ship them (no new subset
was generated). Both are SIL Open Font License 1.1. The license text is served with the fonts, at
`/fonts/OFL-source-serif-4.txt` and `/fonts/OFL-public-sans.txt` (source: `public/fonts/`).

| Family | Package (devDependency) | File | License |
|---|---|---|---|
| Source Serif 4 (`wght` 200 to 900) | `@fontsource-variable/source-serif-4` | `source-serif-4-latin-wght-normal.woff2` | SIL OFL 1.1 |
| Public Sans (`wght` 100 to 900) | `@fontsource-variable/public-sans` | `public-sans-latin-wght-normal.woff2` | SIL OFL 1.1 |

When a package is updated, replace the two texts in `public/fonts/` with the `LICENSE` file of the new version.

## Icons

None shipped yet. Icons added later are copied (not installed) and recorded here with source and license: arrows, plus and
close from Lucide (ISC); Discord, WhatsApp and GitHub marks from Simple Icons (CC0), per the design record.
