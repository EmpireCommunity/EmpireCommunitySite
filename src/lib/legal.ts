// The only reader of the legal texts (docs/contracts/site-data.md section 11): the Markdown entry, its rendered content
// and its clause headings for the table of contents. The effective date is returned only when the file has one.
import { getEntry, render } from 'astro:content';
import { slugOf } from './routes.ts';
import type { Locale } from './routes.ts';

export type LegalKey = 'terms' | 'privacy';

export async function getLegal(locale: Locale, key: LegalKey) {
  const entry = await getEntry('legal', `${locale}/${slugOf(key)}`);
  if (entry === undefined) throw new Error(`src/content/legal/${locale}/${slugOf(key)}.md is missing`);
  const { Content, headings } = await render(entry);
  return {
    title: entry.data.title,
    version: entry.data.version,
    effectiveDate: entry.data.effectiveDate,
    Content,
    /** The clauses: every `##` heading, with its explicit id. */
    clauses: headings.filter((heading) => heading.depth === 2).map(({ slug, text }) => ({ id: slug, text })),
  };
}
