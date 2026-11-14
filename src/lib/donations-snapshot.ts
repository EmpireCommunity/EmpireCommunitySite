// The transparency snapshot of the donations service (EmpireCommunitySite-Donations, docs/contracts/donations.md section 6,
// version 6.1, snapshot schema 2). The panel reads ONE same-origin JSON and trusts nothing in it: `parseSnapshot` checks
// the whole shape and refuses (returns `undefined`) on the first thing that is wrong, so a wrong or hostile file renders
// nothing instead of something invented. No DOM here: the same function runs in the browser script and in the tests.
// Display names are the one free-text field of the service, so they get the contract's own allowed set (section 2,
// "Display name": letters, combining marks, decimal digits (Nd only, at most 4 in all), space, `_`, `-`, `'`, at most 20 grapheme clusters) as a second
// line of defence behind the service's filter. Rendering uses `textContent` only (donations-render.ts).

export const TRANSPARENCY_PATH = '/donations/api/v1/transparency';
export const SNAPSHOT_SCHEMA = 2;
export const MAX_LISTED_DONATIONS = 100;
export const MAX_NAME_GRAPHEMES = 20;

export const EXPENSE_CATEGORIES = ['hosting', 'domain', 'power', 'hardware', 'software', 'fees', 'withdrawal', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface LocalizedText {
  'pt-br': string;
  'en-us': string;
}
export interface Donation {
  seq: number;
  date: string;
  cents: number;
  /** The validated display name, or `null` (the page shows "anonymous"). */
  name: string | null;
}
export interface Expense {
  date: string;
  category: ExpenseCategory;
  cents: number;
  /** A company name, or the labels `person` and `owner`. */
  payee: string;
  justification: LocalizedText;
  /** Contract 6.13: present (and `true`) only on a row that replaces an earlier one. */
  corrected?: true;
}
export interface Adjustment {
  date: string;
  /** Signed: an adjustment can add to or take from the balance. */
  cents: number;
  reason: LocalizedText;
  /** Contract 6.13: present (and `true`) only on a row that replaces an earlier one. */
  corrected?: true;
}
export interface Snapshot {
  schema: 2;
  generatedAt: string;
  received: { totalCents: number; count: number; feesCents: number };
  donations: Donation[];
  out: Expense[];
  adjustments: Adjustment[];
  balance: { calculatedCents: number; reconciledOn: string | null };
  audit: { head: string; entries: number };
}

type Obj = Record<string, unknown>;

const MAX_CENTS = 1_000_000_000_000;
const MAX_ROWS = 5000;
const MAX_TEXT = 280; // contract 6.13: a justification or a reason is at most 280 characters
const MAX_PAYEE = 80;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?Z$/;
const HEX = /^[0-9a-f]{16,128}$/;
const NAME_CHARS = /^[\p{L}\p{M}\p{Nd} _'-]+$/u;
const DIGIT = /\p{Nd}/gu;
const MAX_NAME_DIGITS = 4;
// Control and format characters (bidirectional overrides, zero-width, joiners): never in text the page prints.

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Strict object: exactly these keys, no more and no fewer. */
function hasExactKeys(value: Obj, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isCents(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= MAX_CENTS;
}

/** An adjustment is a signed amount in cents; zero is accepted (ruling on P2-08), so one harmless row never hides the panel. */
function isSignedCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= MAX_CENTS;
}

export function isDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DAY.exec(value);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** An ISO instant in UTC: a real calendar day (`Date.parse` rolls 02-30 over to March) and a real time of day (hour 24 is out). */
function isInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = INSTANT.exec(value);
  return match !== null && isDay(match[1]);
}

// Owner text (payee, justification, reason): the contract counts it in grapheme clusters, like the display name, so a text
// with combining accents or an emoji sequence is not refused for its UTF-16 length. A hard unit stop comes first, so no
// absurd string reaches the segmenter. The joiners U+200C and U+200D stay allowed (emoji sequences, Persian); every other
// format character, bidi controls included, is still refused.
const MAX_TEXT_UNITS_PER_GRAPHEME = 16;
const FORBIDDEN_OWNER_TEXT = /[\p{Cc}\p{Cs}\p{Co}\p{Cn}\u2028\u2029]|(?![\u200C\u200D])\p{Cf}/u;

function graphemeCount(value: string): number {
  if (typeof Intl.Segmenter !== 'function') return withoutSegmenter(value).length;
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length;
}

function isPlainText(value: unknown, max: number): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > max * MAX_TEXT_UNITS_PER_GRAPHEME) return false;
  return value.trim() === value && !FORBIDDEN_OWNER_TEXT.test(value) && graphemeCount(value) <= max;
}

const MAX_MARKS_PER_GRAPHEME = 2;
// A hard stop before any segmentation work on an absurd string; the contract caps the raw field at 200 bytes.
const MAX_NAME_UNITS = 200;
const MARK = /\p{M}/gu;
const LETTER = /^\p{L}$/u;
// Scripts a letter can belong to, tested through Script_Extensions as UTS 39 reads it. A letter of a script not listed here
// counts as one unlisted script, so it can still not be mixed with a listed one.
const SCRIPTS = [
  'Latin', 'Cyrillic', 'Greek', 'Armenian', 'Georgian', 'Hebrew', 'Arabic', 'Syriac', 'Thaana', 'Coptic', 'Cherokee', 'Canadian_Aboriginal',
  'Devanagari', 'Bengali', 'Gurmukhi', 'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Sinhala', 'Thai', 'Lao', 'Tibetan',
  'Myanmar', 'Khmer', 'Mongolian', 'Ethiopic', 'Hangul', 'Hiragana', 'Katakana', 'Bopomofo', 'Han', 'Tifinagh', 'Lisu', 'Vai', 'Osage',
  'Runic', 'Ogham', 'Glagolitic', 'Gothic', 'Adlam', 'Nko', 'Yi',
].map((script) => ({ script, test: new RegExp(`^\\p{Script_Extensions=${script}}$`, 'u') }));
const UNLISTED = 'Unlisted';

/** Without `Intl.Segmenter`: one cluster per base character, each combining mark joined to the character before it. */
function withoutSegmenter(value: string): string[] {
  const parts: string[] = [];
  for (const char of value) {
    const last = parts.length - 1;
    if (last >= 0 && /^\p{M}$/u.test(char)) parts[last] = `${parts[last]}${char}`;
    else parts.push(char);
  }
  return parts;
}

/** Grapheme clusters of a name, or `undefined` when one carries more combining marks than the contract allows. */
function graphemes(value: string): string[] | undefined {
  const parts =
    typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map((part) => part.segment)
      : withoutSegmenter(value);
  return parts.every((part) => (part.match(MARK) ?? []).length <= MAX_MARKS_PER_GRAPHEME) ? parts : undefined;
}

/**
 * One script only (contract section 2, rule 3, T-56 V2): the letters share one Unicode script, read from Script_Extensions
 * and ignoring Common and Inherited (digits, marks, space and punctuation). Latin mixed with Cyrillic is refused, and so is
 * a mix of Japanese scripts (the contract's accepted cost).
 */
function singleScript(value: string): boolean {
  let common: Set<string> | undefined;
  for (const char of value) {
    if (!LETTER.test(char)) continue;
    const scripts = SCRIPTS.filter(({ test }) => test.test(char)).map(({ script }) => script);
    const set = new Set(scripts.length > 0 ? scripts : [UNLISTED]);
    common = common === undefined ? set : new Set([...common].filter((script) => set.has(script)));
    if (common.size === 0) return false;
  }
  return true;
}

/**
 * The contract's display-name rules (section 2 and its G2 cases) as a read-side check: the allowed character set, at most 20
 * grapheme clusters, and at most 2 combining marks in one cluster (a stack of marks is how a name draws outside its cell).
 */
export function isDisplayName(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_NAME_UNITS) return false;
  if (value.trim() !== value || value.trim().length === 0) return false;
  if (!NAME_CHARS.test(value)) return false;
  if ((value.match(DIGIT) ?? []).length > MAX_NAME_DIGITS) return false; // a phone number is not a nickname
  if (!singleScript(value)) return false; // Latin mixed with look-alike Cyrillic is not one nickname
  const parts = graphemes(value);
  return parts !== undefined && parts.length <= MAX_NAME_GRAPHEMES;
}

function isLocalized(value: unknown): value is LocalizedText {
  return isObject(value) && hasExactKeys(value, ['pt-br', 'en-us']) && isPlainText(value['pt-br'], MAX_TEXT) && isPlainText(value['en-us'], MAX_TEXT);
}

function isDonation(value: unknown): value is Donation {
  if (!isObject(value) || !hasExactKeys(value, ['seq', 'date', 'cents', 'name'])) return false;
  return isCents(value.seq, 1) && isDay(value.date) && isCents(value.cents, 1) && (value.name === null || isDisplayName(value.name));
}

/** The optional `corrected` marker (contract 6.13): absent, or exactly `true`. The row keys are the base ones plus it. */
function hasRowKeys(value: Obj, keys: readonly string[]): boolean {
  if (!Object.hasOwn(value, 'corrected')) return hasExactKeys(value, keys);
  return value.corrected === true && hasExactKeys(value, [...keys, 'corrected']);
}

function isExpense(value: unknown): value is Expense {
  if (!isObject(value) || !hasRowKeys(value, ['date', 'category', 'cents', 'payee', 'justification'])) return false;
  return (
    isDay(value.date) &&
    (EXPENSE_CATEGORIES as readonly unknown[]).includes(value.category) &&
    isCents(value.cents, 1) &&
    isPlainText(value.payee, MAX_PAYEE) &&
    isLocalized(value.justification)
  );
}

function isAdjustment(value: unknown): value is Adjustment {
  if (!isObject(value) || !hasRowKeys(value, ['date', 'cents', 'reason'])) return false;
  return isDay(value.date) && isSignedCents(value.cents) && isLocalized(value.reason);
}

function arrayOf<T>(value: unknown, guard: (item: unknown) => item is T, max: number): value is T[] {
  return Array.isArray(value) && value.length <= max && value.every(guard);
}

const sum = (rows: readonly { cents: number }[]): number => rows.reduce((total, row) => total + row.cents, 0);

/**
 * The balance identity of the contract (section 6): calculated = received total - fees - the sum of `out[]` + the sum of
 * `adjustments[]`. The service refuses to publish a snapshot that breaks it; the panel refuses to show one.
 */
export function balanceHolds(snapshot: Snapshot): boolean {
  return snapshot.balance.calculatedCents === snapshot.received.totalCents - snapshot.received.feesCents - sum(snapshot.out) + sum(snapshot.adjustments);
}

/** Cross-field rules that need more than one section. */
function consistent(snapshot: Snapshot): boolean {
  const { donations, received } = snapshot;
  // `donations[]` is the latest 100: exactly min(count, 100) rows, nothing truncated and nothing missing.
  if (donations.length !== Math.min(received.count, MAX_LISTED_DONATIONS)) return false;
  // Every listed donation is in the totals; when the list is the whole history the totals must match it exactly.
  if (received.count === donations.length && received.totalCents !== sum(donations)) return false;
  if (received.totalCents < sum(donations)) return false; // a partial list can only be a part of the total
  if (received.count > 0 && received.totalCents < 1) return false;
  // Newest first, each `seq` once (a refund leaves a gap, never a repeat).
  for (let index = 1; index < donations.length; index += 1) {
    if ((donations[index - 1]?.seq ?? 0) <= (donations[index]?.seq ?? 0)) return false;
  }
  return balanceHolds(snapshot);
}

/** Validates an untrusted JSON value; `undefined` when anything is wrong (fail closed, never a partial snapshot). */
export function parseSnapshot(input: unknown): Snapshot | undefined {
  if (!isObject(input)) return undefined;
  if (!hasExactKeys(input, ['schema', 'generatedAt', 'received', 'donations', 'out', 'adjustments', 'balance', 'sources', 'audit'])) return undefined;
  const { schema, generatedAt, received, donations, out, adjustments, balance, sources, audit } = input;
  if (schema !== SNAPSHOT_SCHEMA || !isInstant(generatedAt)) return undefined;
  if (!isObject(received) || !hasExactKeys(received, ['totalCents', 'count', 'feesCents'])) return undefined;
  if (!isCents(received.totalCents, 0) || !isCents(received.count, 0) || !isCents(received.feesCents, 0)) return undefined;
  if (!arrayOf(donations, isDonation, MAX_LISTED_DONATIONS)) return undefined;
  if (!arrayOf(out, isExpense, MAX_ROWS) || !arrayOf(adjustments, isAdjustment, MAX_ROWS)) return undefined;
  if (!isObject(balance) || !hasExactKeys(balance, ['calculatedCents', 'reconciledOn'])) return undefined;
  if (typeof balance.calculatedCents !== 'number' || !Number.isSafeInteger(balance.calculatedCents) || Math.abs(balance.calculatedCents) > MAX_CENTS) return undefined;
  if (balance.reconciledOn !== null && !isDay(balance.reconciledOn)) return undefined;
  if (!isObject(sources) || !hasExactKeys(sources, ['received', 'out', 'adjustments', 'balance'])) return undefined;
  // `sources.received` names the payment provider. The site's payment guard forbids the provider's name anywhere in its
  // output (donations contract section 2, site side), so the script checks the label's shape, not its spelling; the
  // service's own tests pin the value. The panel never prints it.
  if (typeof sources.received !== 'string' || !/^[a-z]{1,32}$/.test(sources.received)) return undefined;
  if (sources.out !== 'owner' || sources.adjustments !== 'owner' || sources.balance !== 'calculated') return undefined;
  if (!isObject(audit) || !hasExactKeys(audit, ['head', 'entries'])) return undefined;
  if (typeof audit.head !== 'string' || !HEX.test(audit.head) || !isCents(audit.entries, 0)) return undefined;

  const snapshot: Snapshot = {
    schema: SNAPSHOT_SCHEMA,
    generatedAt,
    received: { totalCents: received.totalCents, count: received.count, feesCents: received.feesCents },
    donations: donations.map((row) => ({ seq: row.seq, date: row.date, cents: row.cents, name: row.name })),
    out: out.map((row) => ({ date: row.date, category: row.category, cents: row.cents, payee: row.payee, justification: { ...row.justification }, ...(row.corrected === true ? { corrected: true as const } : {}) })),
    adjustments: adjustments.map((row) => ({ date: row.date, cents: row.cents, reason: { ...row.reason }, ...(row.corrected === true ? { corrected: true as const } : {}) })),
    balance: { calculatedCents: balance.calculatedCents, reconciledOn: balance.reconciledOn },
    audit: { head: audit.head, entries: audit.entries },
  };
  return consistent(snapshot) ? snapshot : undefined;
}

/** True when there is anything real to show: with no data the section is not rendered (site rule R-6). */
export function hasData(snapshot: Snapshot): boolean {
  return snapshot.received.count > 0 || snapshot.out.length > 0 || snapshot.adjustments.length > 0;
}

// Formatting. `lang` is the page language (`pt-BR` or `en-US`). Money is BRL in integer cents, formatted like the rest of
// the site (support-rules.ts `formatBrl`); a day has no time of day and no time zone, so it is formatted as UTC.

const currency = (lang: string): Intl.NumberFormat => new Intl.NumberFormat(lang, { style: 'currency', currency: 'BRL' });

export function formatCents(cents: number, lang: string): string {
  return currency(lang).format(cents / 100);
}

/** An amount with its sign written out, so direction never rests on colour alone. */
export function formatSigned(cents: number, lang: string, direction: 'in' | 'out'): string {
  const sign = direction === 'in' ? '+' : '−';
  return `${sign} ${formatCents(Math.abs(cents), lang)}`;
}

export function formatDay(day: string, lang: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(lang, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1)),
  );
}

/** The instant the snapshot was built, in the time zone of the contract's schedule (America/Sao_Paulo). */
export function formatGeneratedAt(instant: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(instant));
}
