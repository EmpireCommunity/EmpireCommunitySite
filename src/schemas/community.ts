// docs/contracts/site-data.md section 5. src/data/community.yaml is not shipped until the owner supplies a
// verified `discord.membersBuiltIn` (the value is never invented); the collection in src/content.config.ts
// is optional for now and validates this schema whenever the file exists.
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
