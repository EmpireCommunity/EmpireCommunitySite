// The load, validate and show flow of the transparency panel (docs/contracts/donations.md section 6, plan P2-08), kept out
// of the browser entry script so it can be run against a stand-in page, a stand-in `fetch` and a stand-in timer in the
// tests (no network, no real clock, no sleep). One same-origin JSON, validated whole before anything is drawn, written
// with `textContent` only. No data, no section (site rule R-6); a failed or invalid answer shows one plain sentence and
// never a partial list; labels that did not arrive mean nothing renders at all. The request is same-origin with no redirect,
// the answer must be JSON and no larger than `MAX_BODY_CHARS`, and it is checked before it is parsed. No cookie, no storage, no credentials.
import { adjustmentRows, donationRows, expenseRows, fieldValues } from './donations-render.ts';
import type { PanelDocument, PanelElement, PanelLabels, PanelLocale } from './donations-render.ts';
import { EXPENSE_CATEGORIES, TRANSPARENCY_PATH, hasData, parseSnapshot } from './donations-snapshot.ts';
import type { Snapshot } from './donations-snapshot.ts';

export const FETCH_TIMEOUT_MS = 8000;

/** The part of an element the controller touches. A real `HTMLElement` satisfies it. */
export interface PanelNode {
  hidden: boolean;
  textContent: string | null;
  readonly dataset: Readonly<Record<string, string | undefined>>;
  querySelector(selector: string): PanelNode | null;
  querySelectorAll(selector: string): Iterable<PanelNode>;
  replaceChildren(...rows: PanelElement[]): void;
}

/** How the snapshot is requested: this origin only, no credentials, no redirect followed. */
export interface FetchInit {
  credentials: 'omit';
  cache: 'default';
  mode: 'same-origin';
  redirect: 'error';
  signal: AbortSignal;
}

/** The part of a `Response` the flow reads: the body is read as text so its size is checked before it is parsed. */
export interface PanelResponse {
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

/** The snapshot holds at most 100 donations plus the owner's expenses: far below this. A larger body is refused unparsed. */
export const MAX_BODY_CHARS = 256 * 1024; // the contract caps the whole snapshot at 256 KB (6.13)
const JSON_TYPE = /^application\/json\s*(;|$)/i;

/** Everything outside the page the flow needs, injected: the browser entry passes the real ones. */
export interface PanelEnv {
  doc: PanelDocument;
  /** The page language (`pt-BR` or `en-US`). */
  lang: string;
  fetch(url: string, init: FetchInit): Promise<PanelResponse>;
  /** Runs `run` once after `ms`; returns the function that cancels it. */
  timer(run: () => void, ms: number): () => void;
}

/** The labels sit in `data-label-*` attributes written by the server from the locale messages; one missing means no render. */
function labelsOf(root: PanelNode): PanelLabels | undefined {
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

function setHidden(root: PanelNode, selector: string, hidden: boolean): void {
  for (const element of root.querySelectorAll(selector)) element.hidden = hidden;
}

function show(root: PanelNode, snapshot: Snapshot, labels: PanelLabels, env: PanelEnv): void {
  const { doc, lang } = env;
  const locale: PanelLocale = lang.toLowerCase() === 'en-us' ? 'en-us' : 'pt-br';
  for (const [name, value] of Object.entries(fieldValues(snapshot, lang))) {
    for (const element of root.querySelectorAll(`[data-field="${name}"]`)) element.textContent = value;
  }
  root.querySelector('[data-rows="donations"]')?.replaceChildren(...donationRows(doc, snapshot, lang, labels));
  root.querySelector('[data-rows="out"]')?.replaceChildren(...expenseRows(doc, snapshot, lang, locale, labels));
  root.querySelector('[data-rows="adjustments"]')?.replaceChildren(...adjustmentRows(doc, snapshot, lang, locale, labels));
  setHidden(root, '[data-block="donations"]', snapshot.donations.length === 0);
  setHidden(root, '[data-block="out"]', snapshot.out.length === 0);
  setHidden(root, '[data-block="adjustments"]', snapshot.adjustments.length === 0);
  setHidden(root, '[data-block="adjustments-line"]', snapshot.adjustments.length === 0);
  setHidden(root, '[data-block="owner-note"]', snapshot.out.length === 0 && snapshot.adjustments.length === 0);
  setHidden(root, '[data-block="reconciled"]', snapshot.balance.reconciledOn === null);
  setHidden(root, '[data-panel-unavailable]', true);
  setHidden(root, '[data-panel-body]', false);
  root.hidden = false;
}

function unavailable(root: PanelNode): void {
  setHidden(root, '[data-panel-body]', true);
  setHidden(root, '[data-panel-unavailable]', false);
  root.hidden = false;
}

/** Runs the whole flow once. Never throws: every failure ends in the unavailable sentence or in nothing at all. */
export async function startPanel(root: PanelNode | null, env: PanelEnv): Promise<void> {
  if (root === null) return;
  const labels = labelsOf(root);
  if (labels === undefined) return;
  // AbortController and a timer, not `AbortSignal.timeout`, which older browsers lack.
  const controller = new AbortController();
  const cancelTimer = env.timer(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await env.fetch(TRANSPARENCY_PATH, {
      credentials: 'omit',
      cache: 'default',
      mode: 'same-origin',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok || !JSON_TYPE.test(response.headers.get('content-type') ?? '')) return unavailable(root);
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BODY_CHARS) return unavailable(root);
    const body = await response.text();
    if (body.length > MAX_BODY_CHARS) return unavailable(root);
    const snapshot = parseSnapshot(JSON.parse(body));
    if (snapshot === undefined) return unavailable(root);
    if (hasData(snapshot)) show(root, snapshot, labels, env);
  } catch {
    unavailable(root);
  } finally {
    cancelTimer();
  }
}
