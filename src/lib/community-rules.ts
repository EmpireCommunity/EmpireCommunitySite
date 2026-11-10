// Pure rules of the /discord page (docs/contracts/site-data.md section 14). No Astro imports, so they run under `node --test`.
import type { Locale } from './routes.ts';

/** `27 de fevereiro de 2025` (pt-BR) and `February 27, 2025` (en-US). The date is a calendar date: no time zone shift. */
export function formatRulesDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'pt-br' ? 'pt-BR' : 'en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** The approved invite URL, from the single source (`site.yaml` `discord.inviteCode`). */
export function inviteUrl(inviteCode: string): string {
  return `https://discord.com/invite/${inviteCode}`;
}
