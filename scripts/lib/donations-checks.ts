// Checks of the donations parts of the Support page (donations contract section 2 and 6.15, site-data section 10, plan P2-09),
// shared by the build (`scripts/check-dist.ts`) and the live integrity monitor (`scripts/lib/integrity-rules.ts`). Pure:
// HTML text in, findings out.
//
// The page is read with parse5, a parser that implements the HTML Standard's tree construction, so the checks run on the tree a
// browser builds and never on a hand-made reading of the text. Two earlier hand-written scanners were each bypassed by a
// stretch a browser reads differently (a quote, a no-break space, markup inside an svg script), and that is why none is left.
// The page is parsed twice, with scripting on and off, because a `noscript` element holds text in one reading and markup in the
// other; every rule applies to both trees and a finding in either counts. Any parse error the standard names is a finding too:
// Astro writes clean HTML, and markup that needs error recovery to mean anything is markup to refuse. Attribute values are the
// decoded ones the browser sees: `&#47;` is a slash here as it is there.
import { parse } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import { CHECKOUT_PATH } from '../../src/lib/donation-amount.ts';
import { err } from './dist-checks.ts';
import type { Finding } from './dist-checks.ts';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

interface Item {
  element: Element;
  /** Lower-case tag name. */
  name: string;
  /** Attribute names lower-cased, values decoded; the first of a duplicate wins, as in a browser. */
  attrs: Map<string, string>;
}

interface Reading {
  /** Every element of the tree in document order. */
  items: Item[];
  parseErrors: string[];
}

const isElement = (node: Node): node is Element => 'tagName' in node;

function attrsOf(element: Element): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const attribute of element.attrs) {
    const name = attribute.name.toLowerCase();
    if (!attrs.has(name)) attrs.set(name, attribute.value);
  }
  return attrs;
}

const childrenOf = (node: Node): Node[] => ('childNodes' in node ? node.childNodes : []);
const contentOf = (node: Node): Node | undefined => (node as { content?: Node }).content;

/** Every element of a tree in document order, the content of `template` elements included. */
function elementsOf(root: Node): Item[] {
  const items: Item[] = [];
  const visit = (node: Node): void => {
    if (isElement(node)) items.push({ element: node, name: node.tagName.toLowerCase(), attrs: attrsOf(node) });
    const content = contentOf(node);
    if (content !== undefined) visit(content);
    for (const child of childrenOf(node)) visit(child);
  };
  visit(root);
  return items;
}

/** The elements inside one element, itself excluded. */
const insideOf = (element: Element): Set<Element> => new Set(elementsOf(element).map((item) => item.element).filter((other) => other !== element));

function textOf(node: Node): string {
  if (node.nodeName === '#text') return (node as { value: string }).value;
  const content = contentOf(node);
  return [...(content === undefined ? [] : [content]), ...childrenOf(node)].map(textOf).join('');
}

/** The two readings of a page: scripting on and off (what a `noscript` element means differs between them). */
function readings(html: string): Reading[] {
  return [true, false].map((scriptingEnabled) => {
    const parseErrors: string[] = [];
    const document = parse(html, { scriptingEnabled, onParseError: (error) => parseErrors.push(error.code) });
    return { items: elementsOf(document), parseErrors };
  });
}

/** The one address the donation form may post to (donations contract section 2): the service, on the same origin. */
export const CHECKOUT_ACTION = CHECKOUT_PATH;
const CHECKOUT_FIELDS: ReadonlySet<string> = new Set(['amount', 'locale', 'display_name']);
const CONTROLS: ReadonlySet<string> = new Set(['input', 'select', 'textarea', 'button', 'output', 'object', 'fieldset']);
const FORM_OVERRIDES = ['formaction', 'formmethod', 'formtarget', 'formenctype', 'formnovalidate'] as const;
/** Elements the open block never holds: the ones that load, redirect or script, and the svg animations that can rewrite an address. */
const FORBIDDEN_IN_BLOCK: ReadonlySet<string> = new Set([
  'script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'frame', 'frameset', 'applet',
  'animate', 'set', 'animatetransform', 'animatemotion',
]);
const URL_ATTRIBUTES: ReadonlySet<string> = new Set(['href', 'src', 'action', 'poster', 'data', 'srcset', 'background', 'cite', 'ping', 'manifest']);
/** A local address: one slash that is not followed by a slash or a backslash (a protocol-relative address), or a fragment. */
const LOCAL_ADDRESS = /^(?:\/(?![/\\])|#)/;
/** `&`, a space or a control character (C0, DEL, C1), by code point, so the check holds no control character in a pattern. */
const hasUnsafeAddressCharacter = (value: string): boolean =>
  [...value].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return char === '&' || code <= 0x20 || (code >= 0x7f && code <= 0x9f);
  });

const DONATIONS_SCRIPT = /(?:^|[/\\])Donations[^/\\]*\.js(?:$|[?#])/i;
const DONATIONS_STATES = ['not-open', 'open', 'soon'];

/**
 * The `open` block (donations contract section 2, P2-09): exactly one form, posting by POST to the donations service on the
 * same origin and nowhere else. It posts only `amount`, `locale` and `display_name`, has one submit button, optional nameless
 * `type="button"` quick-fill buttons in a container that stays `hidden` until the script runs, no pattern on the amount, and
 * every address in it is a plain local one. No payment host is ever written in the page (that is a header, the CSP).
 */
function openBlockFindings(inside: readonly Item[], file: string, locale: string | undefined): Finding[] {
  const findings: Finding[] = [];
  const forms = inside.filter((item) => item.name === 'form');
  if (forms.length !== 1) return [err(file, `the open block needs exactly one form, found ${forms.length}`)];
  const form = forms[0]?.attrs ?? new Map<string, string>();
  if ((form.get('method') ?? '').toLowerCase() !== 'post') findings.push(err(file, 'the donation form must use method="post"'));
  if (form.get('action') !== CHECKOUT_ACTION) findings.push(err(file, `the donation form action must be exactly ${CHECKOUT_ACTION}`));
  const enctype = form.get('enctype');
  if (enctype !== undefined && enctype.toLowerCase() !== 'application/x-www-form-urlencoded') findings.push(err(file, 'the donation form takes the default encoding only'));
  if (form.has('target')) findings.push(err(file, 'the donation form has no target'));
  for (const item of inside) {
    if (FORBIDDEN_IN_BLOCK.has(item.name)) findings.push(err(file, `the open block holds no <${item.name}>`));
    for (const attribute of item.element.attrs) {
      const name = attribute.name.toLowerCase();
      if (!URL_ATTRIBUTES.has(name)) continue;
      // `&` and any control or space character are refused before the local test: the value here is the decoded one the browser resolves.
      if (hasUnsafeAddressCharacter(attribute.value) || !LOCAL_ADDRESS.test(attribute.value)) {
        findings.push(err(file, `the open block holds only plain local addresses: ${name}=${JSON.stringify(attribute.value)}`));
      }
    }
  }
  const named = new Map<string, Map<string, string>[]>();
  let submits = 0;
  for (const item of inside) {
    if (!CONTROLS.has(item.name)) continue;
    const attrs = item.attrs;
    const type = (attrs.get('type') ?? (item.name === 'button' ? 'submit' : 'text')).toLowerCase();
    if (item.name === 'button') {
      // One submit button; any other button is a script quick-fill: `type="button"`, so it never submits, and no name, so it is never posted.
      if (type === 'submit') submits += 1;
      else if (type !== 'button' || attrs.has('name')) findings.push(err(file, 'a button of the donation form is the submit button or a nameless type="button"'));
      continue;
    }
    if (item.name !== 'input') findings.push(err(file, `the donation form has no ${item.name}`));
    if (['radio', 'checkbox', 'file', 'image', 'submit', 'reset'].includes(type)) findings.push(err(file, `the donation form has no ${type} input`));
    const name = attrs.get('name');
    if (name === undefined) continue;
    if (!CHECKOUT_FIELDS.has(name)) findings.push(err(file, `the donation form posts an unknown field: ${name}`));
    const typed = new Map(attrs);
    typed.set('type', type);
    named.set(name, [...(named.get(name) ?? []), typed]);
  }
  if (submits !== 1) findings.push(err(file, `the donation form needs exactly one submit button, found ${submits}`));
  const locales = named.get('locale') ?? [];
  const holder = locales[0];
  if (locales.length !== 1 || holder?.get('type') !== 'hidden' || (locale === undefined ? !/^(?:pt-br|en-us)$/.test(holder.get('value') ?? '') : holder.get('value') !== locale)) {
    findings.push(err(file, 'the donation form needs one hidden locale field holding the page locale'));
  }
  const names = named.get('display_name') ?? [];
  if (names.length !== 1 || names[0]?.get('type') !== 'text' || names[0]?.get('maxlength') !== '20') {
    findings.push(err(file, 'the donation form needs one display_name text field with maxlength="20"'));
  }
  const amounts = named.get('amount') ?? [];
  const amount = amounts[0];
  if (amounts.length !== 1 || amount?.get('type') !== 'text' || amount.get('maxlength') !== '14' || !amount.has('required') || (amount.get('inputmode') ?? '').toLowerCase() !== 'decimal') {
    findings.push(err(file, 'the donation form needs one amount text field: inputmode="decimal", required, maxlength="14"'));
  }
  if (amount?.has('pattern') === true) findings.push(err(file, 'the amount field has no pattern: the service is the only parser (donations contract 6.15)'));
  if (inside.some((item) => item.attrs.has('data-amount-presets') && !item.attrs.has('hidden'))) findings.push(err(file, 'the preset buttons container stays hidden until the script runs'));
  return findings;
}

type State = 'not-open' | 'open' | 'invalid';

/** One reading of a page: its donations findings and the state of its one block. */
function inspect(reading: Reading, file: string, locale: string | undefined): { state: State; findings: Finding[] } {
  const { items } = reading;
  const findings: Finding[] = [...new Set(reading.parseErrors)].map((code) => err(file, `the support page is not clean HTML: parse error ${code}`));
  const marked = items.filter((item) => item.attrs.has('data-donations'));
  for (const item of marked) {
    if (!DONATIONS_STATES.includes(item.attrs.get('data-donations') ?? '')) findings.push(err(file, 'data-donations is "not-open", "open" or "soon"'));
  }
  const blocks = marked.filter((item) => ['not-open', 'open'].includes(item.attrs.get('data-donations') ?? ''));
  for (const item of items) {
    if (item.attrs.has('form')) findings.push(err(file, `the support page has no form attribute: <${item.name} form="${item.attrs.get('form')}">`));
    for (const override of FORM_OVERRIDES) if (item.attrs.has(override)) findings.push(err(file, `no element may override the form action, method, target or encoding: ${override}`));
  }
  const block = blocks[0];
  if (blocks.length !== 1 || block === undefined) {
    findings.push(err(file, `expected exactly one data-donations block ("not-open" or "open"), found ${blocks.length}`));
    return { state: 'invalid', findings };
  }
  const within = insideOf(block.element);
  const inside = items.filter((item) => within.has(item.element));
  for (const item of items) {
    if (item === block || within.has(item.element)) continue;
    if (CONTROLS.has(item.name) && item.attrs.has('name')) findings.push(err(file, `a named control outside the donations block: <${item.name} name="${item.attrs.get('name')}">`));
    if (item.name === 'form') findings.push(err(file, 'the support page carries no form outside the open block'));
  }
  if (block.attrs.get('data-donations') === 'not-open') {
    if (inside.length > 0) findings.push(err(file, 'the data-donations="not-open" block must be plain text: no link, form, button or other markup'));
    for (const item of items) {
      if (item.name === 'form') findings.push(err(file, 'a page with donations not open carries no form'));
      if (item.attrs.has('data-donations-panel')) findings.push(err(file, 'a page with donations not open carries no transparency panel marker'));
      if (item.name === 'script' && DONATIONS_SCRIPT.test(item.attrs.get('src') ?? '')) findings.push(err(file, `a page with donations not open loads no Donations script: ${item.attrs.get('src')}`));
    }
    return { state: 'not-open', findings };
  }
  findings.push(...openBlockFindings(inside, file, locale));
  return { state: 'open', findings };
}

/**
 * What a support page says about donations: exactly one block, either `not-open` (plain text, no markup) or `open` (the
 * form above). Whole-page rules, in both states and in both readings of the page: no `form` attribute, no form override
 * attribute (`formaction`, `formmethod`, `formtarget`, `formenctype`, `formnovalidate`) on any element, no named control
 * outside the block, no form outside it, and no parse error. Not open: no form, no panel marker and no Donations script at all.
 * Returns the state it found, so the build and the live monitor can each compare it with what they expect. `locale` is the
 * page locale when the caller knows it.
 */
export function donationsBlock(html: string, file: string, locale?: string): { state: State; findings: Finding[] } {
  const results = readings(html).map((reading) => inspect(reading, file, locale));
  const seen = new Set<string>();
  const findings = results.flatMap((result) => result.findings).filter((finding) => !seen.has(finding.message) && seen.add(finding.message));
  const states = new Set(results.map((result) => result.state));
  if (states.size !== 1) return { state: 'invalid', findings: [...findings, err(file, 'the two readings of the page disagree about its donations block')] };
  return { state: results[0]?.state ?? 'invalid', findings };
}

/** The not-open sentence, as the page wrote it, or `undefined` when there is not exactly one plain-text block. */
export function notOpenText(html: string): string | undefined {
  const items = readings(html)[0]?.items ?? [];
  const blocks = items.filter((item) => item.attrs.get('data-donations') === 'not-open');
  const block = blocks[0];
  return blocks.length !== 1 || block === undefined || insideOf(block.element).size > 0 ? undefined : textOf(block.element).trim();
}

/** Support pages send no Referer (donations contract section 2): the return from a payment carries identifiers in its address. */
export function noReferrerMeta(html: string, file: string): Finding[] {
  const items = readings(html)[0]?.items ?? [];
  const metas = items.filter((item) => item.name === 'meta' && (item.attrs.get('name') ?? '').toLowerCase() === 'referrer');
  return metas.length === 1 && (metas[0]?.attrs.get('content') ?? '').toLowerCase() === 'no-referrer' ? [] : [err(file, 'the support page needs exactly one <meta name="referrer" content="no-referrer">')];
}

/**
 * The page declares its encoding first: `<meta charset="utf-8">` is the first element of `head`, so a browser that is not told the
 * encoding by the server still reads the page as UTF-8 (the server also sends it, nginx `charset`). Without either, a browser may
 * guess another encoding and read markup differently from the way these checks do.
 */
export function charsetFirst(html: string, file: string): Finding[] {
  const items = readings(html)[0]?.items ?? [];
  const head = items.find((item) => item.name === 'head');
  const first = head?.element.childNodes.find(isElement);
  const declared = first !== undefined && first.tagName === 'meta' && (attrsOf(first).get('charset') ?? '').toLowerCase() === 'utf-8';
  return declared ? [] : [err(file, 'the first element of <head> must be <meta charset="utf-8">')];
}

/** The state the site data asks for (`support.donations.status`) and what the built page must then carry. */
export interface SupportExpectation {
  status: 'not-open' | 'open';
  /** `support.donations.notOpen`, the one sentence of the not-open block. */
  notOpenMessage: string;
  /** The page locale (`pt-br` or `en-us`): the form's hidden `locale` field must equal it. */
  locale?: string;
}

/**
 * A support page carries exactly one donations block, in the state the site data asks for (site-data section 10, D-28,
 * donations contract section 2). Not open: the required sentence as plain text and nothing else. Open: the form, the "soon"
 * notice absent. Either way: the encoding meta first, the no-referrer meta, and no analytics beacon (the strict baseline of the
 * support pages).
 */
export function supportPage(html: string, file: string, expectation: string | SupportExpectation): Finding[] {
  const wanted: SupportExpectation = typeof expectation === 'string' ? { status: 'not-open', notOpenMessage: expectation } : expectation;
  const found = donationsBlock(html, file, wanted.locale);
  const findings = [...found.findings];
  if (found.state !== 'invalid' && found.state !== wanted.status) findings.push(err(file, `the site data says donations are ${wanted.status}, the page carries the ${found.state} block`));
  if (found.state === 'not-open' && wanted.status === 'not-open') {
    const text = notOpenText(html);
    if (text !== undefined && text !== wanted.notOpenMessage) findings.push(err(file, 'the data-donations="not-open" block does not carry support.donations.notOpen'));
  }
  if (found.state === 'open' && (readings(html)[0]?.items ?? []).some((item) => item.attrs.get('data-donations') === 'soon')) findings.push(err(file, 'the "soon" notice must go when donations are open'));
  findings.push(...noReferrerMeta(html, file), ...charsetFirst(html, file));
  if (/cloudflareinsights|data-cf-beacon/i.test(html)) findings.push(err(file, 'the support pages carry no analytics beacon (site-data section 10)'));
  return findings;
}

/**
 * `donations.status` of the site data and the gate in front of `open` (donations contract section 10). `PENDING.legalPages` is
 * a proxy for "Privacy and Terms carry their new version": the text that covers donations is a human gate at P2-12. Returns the
 * status when it is valid, so the build can tell the page checks what to expect.
 */
export function supportStatus(data: unknown, legalPending: boolean): { status: 'not-open' | 'open' | undefined; findings: Finding[] } {
  const file = 'src/data/support.yaml';
  const donations = typeof data === 'object' && data !== null ? (data as { donations?: unknown }).donations : undefined;
  const status = typeof donations === 'object' && donations !== null ? (donations as { status?: unknown }).status : undefined;
  if (status !== 'not-open' && status !== 'open') return { status: undefined, findings: [err(file, 'donations.status must be "not-open" or "open"')] };
  const findings = status === 'open' && legalPending ? [err(file, 'donations.status "open" waits for the new Privacy and Terms (PENDING.legalPages is not false)')] : [];
  return { status, findings };
}

/** `/donations/` is reserved for the donations service (routing-locale, reserved paths): no built file may sit under it. */
export function reservedDonationsPath(files: readonly string[]): Finding[] {
  return files.filter((file) => /^donations(?:\/|$)/.test(file)).map((file) => err(file, 'the path /donations/ is reserved for the donations service; the site builds nothing under it'));
}

/**
 * The donations parts belong to the support pages only: no other page carries a `data-donations` marker, the panel, or a
 * Donations script, so no other page states or suggests that a donation can be made.
 */
export function donationsBlockElsewhere(html: string, file: string): Finding[] {
  // Raw text, not a tree: nothing to hide behind a quote or a comment. `data-donations` (and the panel marker) and a `Donations*.js`
  // script name are not words any other page has a reason to contain.
  const findings: Finding[] = [];
  if (/data-donations/i.test(html)) findings.push(err(file, 'data-donations belongs to the support pages only'));
  if (/Donations[^"'\s<>/\\]*\.js/i.test(html)) findings.push(err(file, 'a Donations script belongs to the support pages only'));
  return findings;
}
