// Member-count display and payload rules (docs/contracts/members-json.md sections 1 and 3). Shared by the build and by
// the browser script (src/scripts/members.ts) so the two cannot drift. No Astro or DOM imports.

const MIN_MEMBERS = 1;
const MAX_MEMBERS = 1_000_000;
const EXACT_BELOW = 100;
const ROUND_TO = 10;

/**
 * `n < 100` shows `n`; otherwise `floor(n / 10) * 10` with a trailing `+` (888 becomes `880+`). Exactness does not
 * matter (D-14) and this avoids a falsely precise number. `lang` is the page language (`pt-BR` or `en-US`).
 */
export function formatMembers(n: number, lang: string): string {
  const format = new Intl.NumberFormat(lang);
  return n < EXACT_BELOW ? format.format(n) : `${format.format(Math.floor(n / ROUND_TO) * ROUND_TO)}+`;
}

/**
 * The Discord member count of a `members.json` body, or `undefined` for anything the contract says to ignore: another
 * `schema`, a missing or non-integer count, a count outside 1..1,000,000. Unknown fields are ignored.
 */
export function membersFromPayload(data: unknown): number | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const { schema, discord } = data as { schema?: unknown; discord?: unknown };
  if (schema !== 1 || typeof discord !== 'object' || discord === null) return undefined;
  const { members } = discord as { members?: unknown };
  const valid = typeof members === 'number' && Number.isInteger(members) && members >= MIN_MEMBERS && members <= MAX_MEMBERS;
  return valid ? members : undefined;
}
