// Markdown options for the legal pages (docs/contracts/site-data.md section 11). Raw HTML is not rendered: Sätteri keeps
// raw HTML as verbatim nodes by default, so a plugin drops every `html` node (a `<script>` in a legal text can never reach
// the page; the fixture test proves it). `{#id}` after a heading sets its explicit id (parity across locales), and smart
// punctuation is off so the approved text is rendered exactly as written. Shared by astro.config.ts and the tests.
import type { SatteriProcessorOptions } from '@astrojs/markdown-satteri';

export const legalMarkdownOptions: SatteriProcessorOptions = {
  features: { attributes: true, smartPunctuation: false },
  mdastPlugins: [{ name: 'drop-raw-html', html: (node, ctx) => ctx.removeNode(node) }],
};
