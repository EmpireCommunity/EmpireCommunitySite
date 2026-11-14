// The transparency panel of the Support page (docs/contracts/donations.md section 6, plan P2-08). One same-origin JSON,
// validated against the snapshot schema before anything is drawn, written with `textContent` only. The panel is empty
// until there is real data: no data, no section (site rule R-6). A failed or invalid answer shows one plain sentence and
// never a partial list. The page renders this script only when donations are open (support.astro), so it never runs while
// the site shows "not open". No cookie, no storage, no credentials sent.
import { adjustmentRows, donationRows, expenseRows, fieldValues } from '../lib/donations-render.ts';
import type { PanelLabels, PanelLocale } from '../lib/donations-render.ts';
import { EXPENSE_CATEGORIES, TRANSPARENCY_PATH, hasData, parseSnapshot } from '../lib/donations-snapshot.ts';
import type { Snapshot } from '../lib/donations-snapshot.ts';

const FETCH_TIMEOUT_MS = 8000;

/** The labels sit in `data-label-*` attributes written by the server from the locale messages; one missing means no render. */
function labelsOf(root: HTMLElement): PanelLabels | undefined {
  const { labelAnonymous, labelReceived, labelSpent, labelPerson, labelOwner } = root.dataset;
  if (labelAnonymous === undefined || labelReceived === undefined || labelSpent === undefined || labelPerson === undefined || labelOwner === undefined) {
    return undefined;
  }
  const categories = {} as Record<(typeof EXPENSE_CATEGORIES)[number], string>;
  for (const category of EXPENSE_CATEGORIES) {
    const label = root.dataset[`labelCategory${category.charAt(0).toUpperCase()}${category.slice(1)}`];
    if (label === undefined) return undefined;
    categories[category] = label;
  }
  return { anonymous: labelAnonymous, received: labelReceived, spent: labelSpent, person: labelPerson, owner: labelOwner, categories };
}

function setHidden(root: HTMLElement, selector: string, hidden: boolean): void {
  for (const element of root.querySelectorAll<HTMLElement>(selector)) element.hidden = hidden;
}

function fill(root: HTMLElement, rows: HTMLElement[], target: string): void {
  const body = root.querySelector<HTMLElement>(`[data-rows="${target}"]`);
  body?.replaceChildren(...rows);
}

function onlyElements(rows: readonly unknown[]): HTMLElement[] {
  return rows.filter((row): row is HTMLElement => row instanceof HTMLElement);
}

function show(root: HTMLElement, snapshot: Snapshot, labels: PanelLabels): void {
  const lang = document.documentElement.lang || 'pt-BR';
  const locale: PanelLocale = lang.toLowerCase() === 'en-us' ? 'en-us' : 'pt-br';
  for (const [name, value] of Object.entries(fieldValues(snapshot, lang))) {
    for (const element of root.querySelectorAll<HTMLElement>(`[data-field="${name}"]`)) element.textContent = value;
  }
  fill(root, onlyElements(donationRows(document, snapshot, lang, labels)), 'donations');
  fill(root, onlyElements(expenseRows(document, snapshot, lang, locale, labels)), 'out');
  fill(root, onlyElements(adjustmentRows(document, snapshot, lang, locale, labels)), 'adjustments');
  setHidden(root, '[data-block="donations"]', snapshot.donations.length === 0);
  setHidden(root, '[data-block="out"]', snapshot.out.length === 0);
  setHidden(root, '[data-block="adjustments"]', snapshot.adjustments.length === 0);
  setHidden(root, '[data-block="adjustments-line"]', snapshot.adjustments.length === 0);
  setHidden(root, '[data-block="reconciled"]', snapshot.balance.reconciledOn === null);
  setHidden(root, '[data-panel-unavailable]', true);
  setHidden(root, '[data-panel-body]', false);
  root.hidden = false;
}

function unavailable(root: HTMLElement): void {
  setHidden(root, '[data-panel-body]', true);
  setHidden(root, '[data-panel-unavailable]', false);
  root.hidden = false;
}

async function load(root: HTMLElement): Promise<void> {
  const labels = labelsOf(root);
  if (labels === undefined) return;
  try {
    const response = await fetch(TRANSPARENCY_PATH, { credentials: 'omit', cache: 'default', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return unavailable(root);
    const snapshot = parseSnapshot(await response.json());
    if (snapshot === undefined) return unavailable(root);
    if (hasData(snapshot)) show(root, snapshot, labels);
  } catch {
    unavailable(root);
  }
}

const root = document.querySelector<HTMLElement>('[data-donations-panel]');
if (root !== null) void load(root);
