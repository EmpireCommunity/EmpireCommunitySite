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
  links: z.strictObject({ discord: z.literal(DISCORD_URL), github: HttpsUrl, contributing: HttpsUrl }),
  // The one place the approved invite is defined (D-29): read by the /discord page, the Worker and the integrity check.
  discord: z.strictObject({
    inviteCode: z.string().regex(/^[A-Za-z0-9-]{2,32}$/),
    // Quoted in YAML so it stays a string (a 19-digit id is not a safe JavaScript number).
    guildId: z.string().regex(/^\d{17,20}$/),
  }),
});
export type Site = z.infer<typeof SiteSchema>;
