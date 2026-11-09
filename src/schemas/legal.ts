// docs/contracts/site-data.md section 11. Front matter of src/content/legal/<locale>/<slug>.md.
// Slug-equals-file-name, locale-equals-folder and the pt-br/en-us parity checks are build checks (Forja).
import { z } from 'astro/zod';
import { IsoDate, Locale, Text } from './common.ts';

export const LegalSchema = z.strictObject({
  title: Text(120),
  slug: z.enum(['terms-of-service', 'privacy-policy']),
  locale: Locale,
  version: z.string().regex(/^\d+\.\d+$/),
  effectiveDate: IsoDate,
});
export type Legal = z.infer<typeof LegalSchema>;
