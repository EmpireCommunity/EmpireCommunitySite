// docs/contracts/site-data.md section 5. `discord.membersBuiltIn` is required: a verified reading set by the owner, never
// invented. It feeds the HTML and `dist/data/members.json` (members-json section 4).
import { z } from 'astro/zod';
import { IsoDate, Localized } from './common.ts';

export const CommunitySchema = z.strictObject({
  foundedYear: z.number().int().min(1990).max(2100).optional(),
  purpose: Localized(600).optional(),
  discord: z.strictObject({ membersBuiltIn: z.number().int().min(1).max(1_000_000) }),
  // pt-BR only. `asOf` is a review trail and is never displayed (D-14).
  whatsapp: z.strictObject({ members: z.number().int().min(1).max(1_000_000), asOf: IsoDate }).optional(),
});
export type Community = z.infer<typeof CommunitySchema>;
