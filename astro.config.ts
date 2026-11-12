import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { legalMarkdownOptions } from './src/lib/legal-markdown.ts';
import { isSitemapPath } from './src/lib/routes.ts';

// Rules other documents rely on: docs/adr/0001-stack.md section 1 and docs/contracts/routing-locale.md.
export default defineConfig({
  site: 'https://empirecommunity.org',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Strict CSP without 'unsafe-inline': stylesheets and small assets are always separate files.
    inlineStylesheets: 'never',
  },
  // Markdown exists only for the legal texts (src/content/legal): no raw HTML, explicit heading ids.
  markdown: { processor: satteri(legalMarkdownOptions) },
  devToolbar: { enabled: false },
  i18n: {
    defaultLocale: 'pt-br',
    // Path segments are pt-br / en-us; lang and hreflang values are pt-BR / en-US.
    locales: [
      { path: 'pt-br', codes: ['pt-BR'] },
      { path: 'en-us', codes: ['en-US'] },
    ],
    routing: {
      prefixDefaultLocale: true,
      // The root page is a bilingual chooser (HTTP 200); Cloudflare does the country redirect.
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    // routing-locale section 5: every locale URL, hreflang pairs from the `i18n` option. The filter lists only pages
    // under a locale folder, excluding the noindex gate route as well as both neutral choosers and the 404.
    sitemap({
      i18n: { defaultLocale: 'pt-br', locales: { 'pt-br': 'pt-BR', 'en-us': 'en-US' } },
      filter: (page) => isSitemapPath(new URL(page).pathname),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: { assetsInlineLimit: 0 },
  },
});
