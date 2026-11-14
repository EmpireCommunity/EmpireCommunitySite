// docs/contracts/site-data.md section 10. The site receives no money (D-28): `donations.status` is `not-open` until the
// opening (P2-12), `open` shows the form that posts to the donations service (P2-09); the payment page is never ours. The schema is strict, so a payment field (`pix`, a gateway, a recipient) fails the build instead of riding
// along. Money is integer cents only; totals are derived at load (`src/lib/support-rules.ts`), never stored.
import { z } from 'astro/zod';
import { Image, IsoDate, Localized } from './common.ts';

export const DONATIONS_STATUSES = ['not-open', 'open'] as const;
export type DonationsStatus = (typeof DONATIONS_STATUSES)[number];
export const STATUS_MESSAGE = 'donations.status must be "not-open" or "open" (site-data section 10; "open" waits for P2-12)';

const Cents = z.number().int().min(0).max(100_000_000);

export const PART_CATEGORIES = ['cpu', 'memory', 'storage', 'motherboard', 'cooling', 'psu', 'chassis', 'network', 'other'] as const;
export const PART_STATUSES = ['needed', 'purchased', 'donated'] as const;
export type PartStatus = (typeof PART_STATUSES)[number];

export const PartSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: Localized(80),
    category: z.enum(PART_CATEGORIES),
    quantity: z.number().int().min(1).max(99),
    unitPriceCents: Cents,
    status: z.enum(PART_STATUSES),
    acquiredOn: IsoDate.optional(),
    photo: Image.optional(),
  })
  .superRefine((part, ctx) => {
    const acquired = part.status !== 'needed';
    if (acquired && part.acquiredOn === undefined) {
      ctx.addIssue({ code: 'custom', path: ['acquiredOn'], message: 'acquiredOn is required for a purchased or donated part' });
    }
    if (!acquired && part.acquiredOn !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['acquiredOn'], message: 'a needed part has no acquiredOn' });
    }
  });
export type Part = z.infer<typeof PartSchema>;

export const SupportSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    // Review trail, never displayed. Unverified data is never published.
    verified: z.strictObject({ on: IsoDate, by: z.literal('owner') }),
    donations: z.strictObject({ status: z.enum(DONATIONS_STATUSES, { error: STATUS_MESSAGE }) }),
    goal: z.strictObject({
      id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      title: Localized(60),
      description: Localized(400),
      targetCents: Cents.min(1),
    }),
    specs: z.array(z.strictObject({ label: Localized(40), value: z.string().trim().min(1).max(40) })).max(8).optional(),
    parts: z.array(PartSchema).max(40),
    // A physical part, not money: the route to offer one (Discord or e-mail).
    partDonations: z.strictObject({ accepted: z.boolean(), how: Localized(200) }).optional(),
  })
  .superRefine((support, ctx) => {
    const seen = new Set<string>();
    support.parts.forEach((part, index) => {
      if (seen.has(part.id)) ctx.addIssue({ code: 'custom', path: ['parts', index, 'id'], message: `duplicate part id "${part.id}"` });
      seen.add(part.id);
    });
  });
export type SupportData = z.infer<typeof SupportSchema>;
