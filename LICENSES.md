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

Copied into `src/components/Icon.astro` (nothing installed), monochrome, `currentColor`.

| Icon | Source | License |
|---|---|---|
| Arrow right, plus | Lucide (`arrow-right`, `plus`) | ISC |
| Discord, WhatsApp marks | Simple Icons 16.37.0 (`discord`, `whatsapp`) | CC0 1.0 |

The brand marks stay trademarks of their owners; they are used only to name the channel a button leads to.

## Brand (logo and icons)

The Rack mark, the lockup and the icon set are the project's own artwork (owner-approved, D-40 and D-42), shipped from
`src/assets/brand/lockup-header.svg` (inlined by `Wordmark.astro`) and `public/` (favicon, touch and manifest icons,
Open Graph image). The word in the lockup is the text `EmpireCommunity` set in Source Serif 4 (weight 600) and converted
to outlines; the font is SIL OFL 1.1 (license text in `public/fonts/OFL-source-serif-4.txt`), which allows this use.
