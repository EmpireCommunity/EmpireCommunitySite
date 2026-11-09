import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

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
  vite: {
    plugins: [tailwindcss()],
    build: { assetsInlineLimit: 0 },
  },
});
