import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { legalMarkdownOptions } from '../src/lib/legal-markdown.ts';

// The shared options type allows `undefined` where the renderer's own type does not (exactOptionalPropertyTypes).
const options = legalMarkdownOptions as Parameters<typeof createSatteriMarkdownProcessor>[0];
const render = async (markdown: string) => (await (await createSatteriMarkdownProcessor(options)).render(markdown)).code;

test('a script or any raw HTML in a legal text never reaches the page (site-data section 11)', async () => {
  for (const markdown of [
    '<script>alert(1)</script>',
    'Text <script>alert(1)</script> text',
    '<img src=x onerror=alert(1)>',
    '<div onclick="x()">block</div>',
    '<!-- hidden --><iframe src="https://evil.test"></iframe>',
  ]) {
    const html = await render(`## Clause {#a}\n\n${markdown}`);
    assert.doesNotMatch(html, /<script|<img|<iframe|<div|onerror|onclick|<!--/i, markdown);
  }
});

test('an explicit heading id is kept, and the approved text is not altered by smart punctuation', async () => {
  const html = await render('## 1. About this website {#about}\n\nThe community\'s services are free -- nothing is "for sale".');
  assert.match(html, /<h2 id="about">1\. About this website<\/h2>/);
  assert.match(html, /community's services are free -- nothing is "for sale"\./);
});
