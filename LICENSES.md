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

**The MIT license of this repository covers the code only. It does not apply to the brand files.** The Rack mark, the
lockup, the wordmark as a logo, the icon set and the share image are copyright EmpireCommunity, all rights reserved
(owner decision D-46). No license is granted to copy, modify, redistribute or use them, and the MIT terms do not extend to
them. They are published in this repository only because the site needs them to render.

Files covered:

- `src/assets/brand/` (the lockup, inlined by `Wordmark.astro`);
- in `public/`: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `og-image.png`.

The word in the lockup is the text `EmpireCommunity` set in Source Serif 4 (weight 600) and converted to outlines. The font
itself stays under SIL OFL 1.1 (license text in `public/fonts/OFL-source-serif-4.txt`), which allows this use; the OFL
does not make the logo free to reuse.
