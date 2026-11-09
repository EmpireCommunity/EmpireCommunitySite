// docs/contracts/site-data.md section 9. Personal data: High risk (C-4).
// Rule: only what the person consented to (consent.scope) may exist in the entry. A field outside the
// scope fails the build, so data cannot ride along unconsented. `consent` has no default.
import { z } from 'astro/zod';
import { HttpsUrl, Image, IsoDate, Localized, PersonId, Text } from './common.ts';

const ConsentScope = z.enum(['name', 'nickname', 'role', 'bio', 'photo', 'links']);
type ConsentScopeItem = z.infer<typeof ConsentScope>;

export const ConsentSchema = z.strictObject({
  given: z.literal(true),
  isAdult: z.literal(true),
  recordedOn: IsoDate,
  // Opaque reference to the private record kept outside the repository. Never personal data.
  evidenceRef: z.string().regex(/^[A-Za-z0-9-]{3,40}$/),
  scope: z.array(ConsentScope).min(1),
  historyNoticeGiven: z.literal(true),
  reviewOn: IsoDate,
});

export const TeamMemberSchema = z
  .strictObject({
    id: PersonId,
    isFounder: z.boolean().default(false),
    name: Text(80).optional(),
    nickname: Text(40).optional(),
    role: Localized(60),
    bio: Localized(240).optional(),
    photo: Image.optional(),
    links: z.array(z.strictObject({ kind: z.literal('github'), url: HttpsUrl })).max(5).optional(),
    consent: ConsentSchema,
  })
  .superRefine((member, ctx) => {
    const scope = new Set<ConsentScopeItem>(member.consent.scope);
    if (!scope.has('name') && !scope.has('nickname')) {
      ctx.addIssue({ code: 'custom', path: ['consent', 'scope'], message: 'scope must contain name or nickname' });
    }
    const present: Record<ConsentScopeItem, boolean> = {
      name: member.name !== undefined,
      nickname: member.nickname !== undefined,
      role: true, // required field
      bio: member.bio !== undefined,
      photo: member.photo !== undefined,
      links: member.links !== undefined,
    };
    for (const field of ConsentScope.options) {
      if (present[field] && !scope.has(field)) {
        ctx.addIssue({ code: 'custom', path: [field], message: `${field} is present but not in consent.scope` });
      }
    }
  });
export type TeamMember = z.infer<typeof TeamMemberSchema>;
