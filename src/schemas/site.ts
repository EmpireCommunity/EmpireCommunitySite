// docs/contracts/site-data.md section 4.
import { z } from 'astro/zod';
import { HttpsUrl } from './common.ts';

/** The only Discord link allowed on the site (D-3). A literal in the schema. */
export const DISCORD_URL = 'https://empirecommunity.org/discord';

const Email = z.email();

export const SiteSchema = z.strictObject({
  origin: z.literal('https://empirecommunity.org'),
  organization: z.literal('EmpireCommunity'),
  currency: z.literal('BRL'),
  contact: z.strictObject({ general: Email, legal: Email }),
  links: z.strictObject({ discord: z.literal(DISCORD_URL), github: HttpsUrl }),
});
export type Site = z.infer<typeof SiteSchema>;
