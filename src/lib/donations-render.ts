// Rows of the transparency panel (docs/contracts/donations.md section 6). Everything the snapshot supplies reaches the
// page through `textContent` on an element made with `createElement`: there is no `innerHTML`, no `insertAdjacentHTML`,
// no template string of markup, and no attribute is ever set from snapshot data. The display name is the one field a
// stranger writes, so its cell isolates direction (`dir="auto"` plus `unicode-bidi: isolate` in global.css) and clips
// what does not fit (`.donor-name`, fixed maximum width, T-56 V3). The document is a parameter, so the tests can run the
// same code against a stand-in that throws on any other way of writing text.
import { formatCents, formatDay, formatGeneratedAt, formatSigned } from './donations-snapshot.ts';
import type { Adjustment, Donation, Expense, ExpenseCategory, Snapshot } from './donations-snapshot.ts';

/** The small part of a DOM element the panel uses. A real `HTMLElement` satisfies it. */
export interface PanelElement {
  textContent: string | null;
  className: string;
  setAttribute(name: string, value: string): void;
  append(...children: PanelElement[]): void;
}
export interface PanelDocument {
  createElement(tag: string): PanelElement;
}

/** Text the page owns (from the locale messages), passed in by the entry script from `data-label-*` attributes. */
export interface PanelLabels {
  anonymous: string;
  received: string;
  spent: string;
  person: string;
  owner: string;
  categories: Readonly<Record<ExpenseCategory, string>>;
}

export type PanelLocale = 'pt-br' | 'en-us';

const CELL = 'py-12 pr-16 align-middle text-body-sm text-papel-suave max-md:py-0';
const AMOUNT = 'whitespace-nowrap py-12 text-right align-middle text-body-sm tabular-nums max-md:py-0 max-md:text-left';
const ROW = 'border-t border-pauta max-md:grid max-md:gap-y-4 max-md:py-12';

function make(doc: PanelDocument, tag: string, className: string, text?: string): PanelElement {
  const element = doc.createElement(tag);
  if (className !== '') element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function cell(doc: PanelDocument, className: string, ...children: PanelElement[]): PanelElement {
  const td = make(doc, 'td', className);
  td.append(...children);
  return td;
}

function textCell(doc: PanelDocument, className: string, text: string): PanelElement {
  return cell(doc, className, make(doc, 'span', '', text));
}

/** An amount with its direction in words for assistive technology and its sign in the text: never colour alone. */
function amountCell(doc: PanelDocument, direction: 'in' | 'out', cents: number, lang: string, label: string): PanelElement {
  const tone = direction === 'in' ? 'text-livro-entrada' : 'text-livro-saida';
  const wrap = make(doc, 'span', tone);
  wrap.append(make(doc, 'span', 'sr-only', `${label} `), make(doc, 'span', '', formatSigned(cents, lang, direction)));
  return cell(doc, AMOUNT, wrap);
}

function nameCell(doc: PanelDocument, name: string | null, labels: PanelLabels): PanelElement {
  if (name === null) return cell(doc, CELL, make(doc, 'span', 'text-papel-apagado', labels.anonymous));
  const span = make(doc, 'span', 'donor-name', name);
  span.setAttribute('dir', 'auto');
  return cell(doc, `${CELL} text-papel`, span);
}

export function donationRow(doc: PanelDocument, donation: Donation, lang: string, labels: PanelLabels): PanelElement {
  const tr = make(doc, 'tr', ROW);
  tr.append(
    textCell(doc, `${CELL} whitespace-nowrap tabular-nums`, formatDay(donation.date, lang)),
    nameCell(doc, donation.name, labels),
    amountCell(doc, 'in', donation.cents, lang, labels.received),
  );
  return tr;
}

/** The payee is a company name, or the labels `person` and `owner` (contract section 6), which the page translates. */
function payeeText(payee: string, labels: PanelLabels): string {
  if (payee === 'person') return labels.person;
  if (payee === 'owner') return labels.owner;
  return payee;
}

export function expenseRow(doc: PanelDocument, expense: Expense, lang: string, locale: PanelLocale, labels: PanelLabels): PanelElement {
  const tr = make(doc, 'tr', ROW);
  tr.append(
    textCell(doc, `${CELL} whitespace-nowrap tabular-nums`, formatDay(expense.date, lang)),
    textCell(doc, CELL, labels.categories[expense.category]),
    textCell(doc, `${CELL} text-papel`, payeeText(expense.payee, labels)),
    textCell(doc, CELL, expense.justification[locale]),
    amountCell(doc, 'out', expense.cents, lang, labels.spent),
  );
  return tr;
}

export function adjustmentRow(doc: PanelDocument, adjustment: Adjustment, lang: string, locale: PanelLocale, labels: PanelLabels): PanelElement {
  const tr = make(doc, 'tr', ROW);
  const direction = adjustment.cents > 0 ? 'in' : 'out';
  tr.append(
    textCell(doc, `${CELL} whitespace-nowrap tabular-nums`, formatDay(adjustment.date, lang)),
    textCell(doc, CELL, adjustment.reason[locale]),
    amountCell(doc, direction, adjustment.cents, lang, direction === 'in' ? labels.received : labels.spent),
  );
  return tr;
}

/** Every listed row, newest first as the snapshot gives them. */
export function donationRows(doc: PanelDocument, snapshot: Snapshot, lang: string, labels: PanelLabels): PanelElement[] {
  return snapshot.donations.map((donation) => donationRow(doc, donation, lang, labels));
}

/**
 * Expenses and adjustments are published in full and the contract does not fix their order, so the panel sorts a copy:
 * newest day first, and among rows of one day the later entry first (the sort is stable, the index breaks ties).
 */
export function newestFirst<T extends { date: string }>(rows: readonly T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.date.localeCompare(a.row.date) || b.index - a.index)
    .map(({ row }) => row);
}

export function expenseRows(doc: PanelDocument, snapshot: Snapshot, lang: string, locale: PanelLocale, labels: PanelLabels): PanelElement[] {
  return newestFirst(snapshot.out).map((expense) => expenseRow(doc, expense, lang, locale, labels));
}

export function adjustmentRows(doc: PanelDocument, snapshot: Snapshot, lang: string, locale: PanelLocale, labels: PanelLabels): PanelElement[] {
  return newestFirst(snapshot.adjustments).map((adjustment) => adjustmentRow(doc, adjustment, lang, locale, labels));
}

const sumCents = (rows: readonly { cents: number }[]): number => rows.reduce((total, row) => total + row.cents, 0);

/** The text of every `data-field` of the panel: plain strings, written with `textContent` by the entry script. */
export function fieldValues(snapshot: Snapshot, lang: string): Record<string, string> {
  const adjustments = sumCents(snapshot.adjustments);
  return {
    total: formatCents(snapshot.received.totalCents, lang),
    count: new Intl.NumberFormat(lang).format(snapshot.received.count),
    balance: formatCents(snapshot.balance.calculatedCents, lang),
    sumReceived: formatSigned(snapshot.received.totalCents, lang, 'in'),
    sumFees: formatSigned(snapshot.received.feesCents, lang, 'out'),
    sumOut: formatSigned(sumCents(snapshot.out), lang, 'out'),
    sumAdjustments: adjustments === 0 ? formatCents(0, lang) : formatSigned(adjustments, lang, adjustments > 0 ? 'in' : 'out'),
    generatedAt: formatGeneratedAt(snapshot.generatedAt, lang),
    reconciledOn: snapshot.balance.reconciledOn === null ? '' : formatDay(snapshot.balance.reconciledOn, lang),
  };
}
