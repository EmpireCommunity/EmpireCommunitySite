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

/** BRL as `Intl.NumberFormat` writes it per locale ("R$ 3.000" in pt-BR, "R$3,000" in en-US); cents appear only when the value has them. */
export function formatBrl(cents: number, locale: Locale): string {
  const digits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale === 'pt-br' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}
