// The only read of `support.yaml` (docs/contracts/site-data.md section 10). The collection schema has already refused
// any payment field and any donations state other than `not-open` or `open`; this adds the derived totals. No payment, account
// or donor data exists here, so none can reach a page.
import { getEntry } from 'astro:content';
import { deriveTotals } from './support-rules.ts';
import type { SupportTotals } from './support-rules.ts';
import type { Locale } from './routes.ts';
import type { DonationsStatus, PartStatus } from '../schemas/support.ts';

export interface SupportPart {
  id: string;
  name: string;
  quantity: number;
  /** quantity x unit price, in cents. */
  totalCents: number;
  status: PartStatus;
}

export interface SupportSnapshot {
  donations: { status: DonationsStatus };
  goal: { id: string; title: string; description: string; targetCents: number } & SupportTotals;
  parts: SupportPart[];
  partDonations: { accepted: boolean; how: string } | null;
}

export async function getSupport(locale: Locale): Promise<SupportSnapshot> {
  const entry = await getEntry('support', 'support');
  if (entry === undefined) throw new Error('src/data/support.yaml is missing');
  const { donations, goal, specs, parts, partDonations } = entry.data;
  // `specs` is valid in the schema and the contract but no page renders it yet: owner data fails the build instead of vanishing.
  if (specs !== undefined) throw new Error('support specs: rendering specs is not built yet (support.astro has no place for them)');
  return {
    donations,
    goal: { id: goal.id, title: goal.title[locale], description: goal.description[locale], targetCents: goal.targetCents, ...deriveTotals(parts, goal.targetCents) },
    parts: parts.map((part) => {
      if (part.photo !== undefined) throw new Error(`support part ${part.id}: rendering a photo is not built yet (needs the image pipeline)`);
      return { id: part.id, name: part.name[locale], quantity: part.quantity, totalCents: part.quantity * part.unitPriceCents, status: part.status };
    }),
    partDonations: partDonations === undefined ? null : { accepted: partDonations.accepted, how: partDonations.how[locale] },
  };
}
