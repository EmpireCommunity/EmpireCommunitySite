// docs/contracts/site-data.md section 11. Front matter of src/content/legal/<locale>/<slug>.md.
// The slug, folder and pt-br/en-us parity rules are in src/lib/legal-rules.ts and run on every build.
import { z } from 'astro/zod';
import { IsoDate, Locale, Text } from './common.ts';

// The contract writes `effectiveDate: 2026-12-01` unquoted, and Markdown front matter parses that as a Date
// at UTC midnight, so it is turned back into the ISO string before IsoDate checks it.
const FrontMatterDate = z.preprocess(
  (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : value),
  IsoDate,
);

export const LEGAL_SLUGS = ['terms-of-service', 'privacy-policy'] as const;

export const LegalSchema = z.strictObject({
  title: Text(120),
  slug: z.enum(LEGAL_SLUGS),
  locale: Locale,
  version: z.string().regex(/^\d+\.\d+$/),
  effectiveDate: FrontMatterDate,
});
export type Legal = z.infer<typeof LegalSchema>;
