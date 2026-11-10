// Pure rules of the support module (docs/contracts/site-data.md section 10). Kept free of Astro imports so they run
// under `node --test`. Money is integer cents; nothing here stores or derives anything about donors or payments.
import type { Locale } from './routes.ts';
import type { PartStatus, SupportData } from '../schemas/support.ts';

const ACQUIRED: ReadonlySet<PartStatus> = new Set(['purchased', 'donated']);

export interface SupportTotals {
  securedCents: number;
  remainingCents: number;
  /** 0 to 1. */
  progress: number;
}

/** Secured value is the sum of quantity x unit price over parts already bought or donated, not money received. */
export function deriveTotals(parts: SupportData['parts'], targetCents: number): SupportTotals {
  const securedCents = parts
    .filter((part) => ACQUIRED.has(part.status))
    .reduce((sum, part) => sum + part.quantity * part.unitPriceCents, 0);
  return {
    securedCents,
    remainingCents: Math.max(0, targetCents - securedCents),
    progress: Math.min(1, securedCents / targetCents),
  };
}

/** "R$ 3.000" (pt-BR) and "R$ 3,000" (en-US); cents appear only when the value has them. */
export function formatBrl(cents: number, locale: Locale): string {
  const hasCents = cents % 100 !== 0;
  const number = new Intl.NumberFormat(locale === 'pt-br' ? 'pt-BR' : 'en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(cents / 100);
  return `R$ ${number}`;
}
