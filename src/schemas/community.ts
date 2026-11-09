// docs/contracts/site-data.md section 5. `discord.membersBuiltIn` is a verified reading supplied by the owner and is
// never invented, so it is optional until the owner gives one: without it the pages render no Discord count (a figure
// with no real data is not rendered, R-6) and `dist/data/members.json` is not generated (pending flag `membersFallback`).
import { z } from 'astro/zod';
import { IsoDate, Localized } from './common.ts';

export const CommunitySchema = z.strictObject({
  foundedYear: z.number().int().min(1990).max(2100).optional(),
  purpose: Localized(600).optional(),
  discord: z.strictObject({ membersBuiltIn: z.number().int().min(1).max(1_000_000) }).optional(),
  // pt-BR only. `asOf` is a review trail and is never displayed (D-14).
  whatsapp: z.strictObject({ members: z.number().int().min(1).max(1_000_000), asOf: IsoDate }).optional(),
});
export type Community = z.infer<typeof CommunitySchema>;
