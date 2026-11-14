// Checks of the donations parts of the Support page (donations contract section 2 and 6.15, site-data section 10, plan P2-09),
// shared by the build (`scripts/check-dist.ts`) and the live integrity monitor (`scripts/lib/integrity-rules.ts`). Pure:
// HTML text in, findings out.
//
// The support page is read by a STRICT scanner, not a tolerant one. Every `<` must start a token this scanner accepts: a
// doctype, or a tag whose attributes are each a bare name or `name="value"` with a double-quoted value, separated by white
// space. Anything else on the page is itself a finding: a quote anywhere else (single-quoted or unquoted values), a comment,
// a CDATA section, a `<` that starts nothing, and the elements whose content a browser reads as text instead of markup
// (`noscript`, `template`, `textarea`, `xmp`, `plaintext`, `noembed`, `noframes`). The content of `script` and `style` is
// skipped as the browser skips it. So the scanner and the browser cannot disagree about where a tag ends, and no control can
// hide in a stretch the scanner read as a quoted value (Sentinela M1). Attribute values are compared as written, never
// entity-decoded: a coded variant (`&#47;donations...`, `am&#111;unt`) is not the value the contract names and fails closed.
import { CHECKOUT_PATH } from '../../src/lib/donation-amount.ts';
import { decodeEntities, err } from './dist-checks.ts';
import type { Finding } from './dist-checks.ts';

interface Tag {
  name: string;
  attrs: Map<string, string>;
  closing: boolean;
  /** Offset of `<`, and of the character after `>`. */
  index: number;
  end: number;
}

/** A doctype, or one tag: `<name`, then attributes that are a bare name or `name="value"`, each after white space, then `>`. */
const TOKEN = /<(?:!doctype[^>]*>|(\/?)([a-z][a-z0-9-]*)((?:\s+[a-z_:@][a-z0-9_:.@-]*(?:="[^"]*")?)*)\s*\/?>)/iy;
const ATTRIBUTE = /([^\s=]+)(?:="([^"]*)")?/g;
const RAW_TEXT: ReadonlySet<string> = new Set(['script', 'style']);
const TEXT_ONLY: ReadonlySet<string> = new Set(['noscript', 'template', 'textarea', 'xmp', 'plaintext', 'noembed', 'noframes']);

function attributesOf(text: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const match of text.matchAll(ATTRIBUTE)) {
    const name = (match[1] ?? '').toLowerCase();
    if (!attrs.has(name)) attrs.set(name, match[2] ?? ''); // browsers keep the FIRST of a duplicate attribute
  }
  return attrs;
}

/** The tags of a page, and a finding for every stretch the strict grammar does not accept. */
function scan(html: string): { tags: Tag[]; problems: string[] } {
  const tags: Tag[] = [];
  const problems: string[] = [];
  let position = 0;
  for (;;) {
    const start = html.indexOf('<', position);
    if (start < 0) break;
    TOKEN.lastIndex = start;
    const match = TOKEN.exec(html);
    if (match === null) {
      problems.push(`markup outside the strict grammar (a comment, a quote that is not a double-quoted attribute value, or a "<" that starts no tag) at offset ${start}: ${JSON.stringify(html.slice(start, start + 40))}`);
      position = start + 1;
      continue;
    }
    position = start + match[0].length;
    if (match[2] === undefined) continue; // the doctype
    const tag: Tag = { name: match[2].toLowerCase(), attrs: attributesOf(match[3] ?? ''), closing: match[1] === '/', index: start, end: position };
    tags.push(tag);
    if (!tag.closing && TEXT_ONLY.has(tag.name)) problems.push(`<${tag.name}> is not allowed on the support page: a browser reads its content as text, a scanner reads it as markup`);
    if (!tag.closing && RAW_TEXT.has(tag.name)) {
      const close = new RegExp(`</${tag.name}(?=[\\s/>])`, 'i').exec(html.slice(position));
      if (close === null) {
        problems.push(`<${tag.name}> is never closed`);
        break;
      }
      position += close.index;
    }
  }
  return { tags, problems };
}

const tagsOf = (html: string): Tag[] => scan(html).tags;

/** The tags between an opening tag and its matching close tag (same name, nested ones counted), and the text span between them. */
function elementOf(tags: readonly Tag[], position: number, html: string): { inner: string; within: Tag[]; start: number; end: number } | undefined {
  const opening = tags[position];
  if (opening === undefined) return undefined;
  let depth = 1;
  for (let i = position + 1; i < tags.length; i += 1) {
    const tag = tags[i];
    if (tag === undefined || tag.name !== opening.name) continue;
    depth += tag.closing ? -1 : 1;
    if (depth === 0) return { inner: html.slice(opening.end, tag.index), within: tags.slice(position + 1, i), start: opening.end, end: tag.index };
  }
  return undefined;
}

/** The one address the donation form may post to (donations contract section 2): the service, on the same origin. */
export const CHECKOUT_ACTION = CHECKOUT_PATH;
const CHECKOUT_FIELDS: ReadonlySet<string> = new Set(['amount', 'locale', 'display_name']);
const CONTROLS: ReadonlySet<string> = new Set(['input', 'select', 'textarea', 'button', 'output', 'object']);
const FORM_OVERRIDES = ['formaction', 'formmethod', 'formtarget', 'formenctype', 'formnovalidate'] as const;
const FORBIDDEN_IN_BLOCK: ReadonlySet<string> = new Set(['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'frame', 'frameset', 'applet']);
const URL_ATTRIBUTES = ['href', 'src', 'action', 'poster', 'data', 'srcset', 'xlink:href', 'background', 'cite', 'ping'] as const;
/** A local address: one slash that is not followed by a slash or a backslash (a protocol-relative address), or a fragment. */
const LOCAL_ADDRESS = /^(?:\/(?![/\\])|#)/;
/** `&`, a space or a control character (C0, DEL, C1): by code point, so the check holds no control character in a pattern. */
const hasUnsafeAddressCharacter = (value: string): boolean =>
  [...value].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return char === '&' || code <= 0x20 || (code >= 0x7f && code <= 0x9f);
  });

/**
 * The `open` block (donations contract section 2, P2-09): exactly one form, posting by POST to the donations service on the
 * same origin and nowhere else. It posts only `amount`, `locale` and `display_name`, has one submit button, optional nameless
 * `type="button"` quick-fill buttons in a container that stays `hidden` until the script runs, no pattern on the amount,
 * and every address in it is a local one. No payment host is ever written in the page (that is a header, the CSP).
 */
function openBlockFindings(tags: readonly Tag[], file: string, locale: string | undefined): Finding[] {
  const findings: Finding[] = [];
  const forms = tags.filter((tag) => tag.name === 'form' && !tag.closing);
  if (forms.length !== 1) return [err(file, `the open block needs exactly one form, found ${forms.length}`)];
  const form = forms[0]?.attrs ?? new Map<string, string>();
  if ((form.get('method') ?? '').toLowerCase() !== 'post') findings.push(err(file, 'the donation form must use method="post"'));
  if (form.get('action') !== CHECKOUT_ACTION) findings.push(err(file, `the donation form action must be exactly ${CHECKOUT_ACTION}`));
  const enctype = form.get('enctype');
  if (enctype !== undefined && enctype.toLowerCase() !== 'application/x-www-form-urlencoded') findings.push(err(file, 'the donation form takes the default encoding only'));
  if (form.has('target')) findings.push(err(file, 'the donation form has no target'));
  for (const tag of tags) {
    if (tag.closing) continue;
    if (FORBIDDEN_IN_BLOCK.has(tag.name)) findings.push(err(file, `the open block holds no <${tag.name}>`));
    for (const attribute of URL_ATTRIBUTES) {
      const value = tag.attrs.get(attribute);
      // `&` (a character reference could spell a second slash) and any control or space character (a browser drops a tab or a
      // newline inside an address) are refused before the local test, so the raw value is what the browser resolves (Sentinela M2).
      if (value !== undefined && (hasUnsafeAddressCharacter(value) || !LOCAL_ADDRESS.test(value))) findings.push(err(file, `the open block holds only plain local addresses: ${attribute}=${JSON.stringify(value)}`));
    }
  }
  const named = new Map<string, Map<string, string>[]>();
  let submits = 0;
  for (const tag of tags) {
    if (tag.closing || !CONTROLS.has(tag.name)) continue;
    const attrs = tag.attrs;
    const type = (attrs.get('type') ?? (tag.name === 'button' ? 'submit' : 'text')).toLowerCase();
    if (tag.name === 'button') {
      // One submit button; any other button is a script quick-fill: `type="button"`, so it never submits, and no name, so it is never posted.
      if (type === 'submit') submits += 1;
      else if (type !== 'button' || attrs.has('name')) findings.push(err(file, 'a button of the donation form is the submit button or a nameless type="button"'));
      continue;
    }
    if (tag.name !== 'input') findings.push(err(file, `the donation form has no ${tag.name}`));
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
  const presets = tags.filter((tag) => !tag.closing && tag.attrs.has('data-amount-presets'));
  if (presets.some((tag) => !tag.attrs.has('hidden'))) findings.push(err(file, 'the preset buttons container stays hidden until the script runs'));
  return findings;
}

const DONATIONS_SCRIPT = /(?:^|[/\\])Donations[^/\\]*\.js(?:$|[?#])/i;

/**
 * What a support page says about donations: exactly one block, either `not-open` (plain text, no markup) or `open` (the
 * form above). Whole-page rules, in both states: no `form` attribute, no form override attribute (`formaction`, `formmethod`,
 * `formtarget`, `formenctype`, `formnovalidate`) on any element, no named control outside the block, and no form outside it.
 * Not open: no form, no panel marker and no Donations script at all. Returns the state it found, so the build and the live
 * monitor can each compare it with what they expect. `locale` is the page locale when the caller knows it.
 */
export function donationsBlock(html: string, file: string, locale?: string): { state: 'not-open' | 'open' | 'invalid'; findings: Finding[] } {
  const { tags, problems } = scan(html);
  const findings: Finding[] = problems.map((problem) => err(file, problem));
  const marked = tags.map((tag, position) => ({ tag, position })).filter(({ tag }) => !tag.closing && tag.attrs.has('data-donations'));
  for (const { tag } of marked) {
    if (!['not-open', 'open', 'soon'].includes(tag.attrs.get('data-donations') ?? '')) findings.push(err(file, 'data-donations is "not-open", "open" or "soon"'));
  }
  const blocks = marked.filter(({ tag }) => ['not-open', 'open'].includes(tag.attrs.get('data-donations') ?? ''));
  for (const tag of tags) {
    if (tag.closing) continue;
    if (tag.attrs.has('form')) findings.push(err(file, `the support page has no form attribute: <${tag.name} form="${tag.attrs.get('form')}">`));
    for (const override of FORM_OVERRIDES) if (tag.attrs.has(override)) findings.push(err(file, `no element may override the form action, method, target or encoding: ${override}`));
  }
  if (blocks.length !== 1) {
    findings.push(err(file, `expected exactly one data-donations block ("not-open" or "open"), found ${blocks.length}`));
    return { state: 'invalid', findings };
  }
  const block = blocks[0];
  const element = elementOf(tags, block?.position ?? 0, html);
  if (block === undefined || element === undefined) {
    findings.push(err(file, `the data-donations="${block?.tag.attrs.get('data-donations')}" block is not closed`));
    return { state: 'invalid', findings };
  }
  const outside = tags.filter((tag) => !tag.closing && (tag.index < element.start || tag.index >= element.end));
  for (const tag of outside) {
    if (CONTROLS.has(tag.name) && tag.attrs.has('name')) findings.push(err(file, `a named control outside the donations block: <${tag.name} name="${tag.attrs.get('name')}">`));
    if (tag.name === 'form') findings.push(err(file, 'the support page carries no form outside the open block'));
  }
  if (block.tag.attrs.get('data-donations') === 'not-open') {
    if (element.within.length > 0 || /</.test(element.inner)) findings.push(err(file, 'the data-donations="not-open" block must be plain text: no link, form, button or other markup'));
    for (const tag of tags) {
      if (tag.closing) continue;
      if (tag.name === 'form') findings.push(err(file, 'a page with donations not open carries no form'));
      if (tag.attrs.has('data-donations-panel')) findings.push(err(file, 'a page with donations not open carries no transparency panel marker'));
      if (tag.name === 'script' && DONATIONS_SCRIPT.test(tag.attrs.get('src') ?? '')) findings.push(err(file, `a page with donations not open loads no Donations script: ${tag.attrs.get('src')}`));
    }
    return { state: 'not-open', findings };
  }
  findings.push(...openBlockFindings(element.within, file, locale));
  return { state: 'open', findings };
}

/** The not-open sentence, as the page wrote it, or `undefined` when the block is not a plain-text one. */
function notOpenText(html: string): string | undefined {
  const tags = tagsOf(html);
  const position = tags.findIndex((tag) => !tag.closing && tag.attrs.get('data-donations') === 'not-open');
  const element = position < 0 ? undefined : elementOf(tags, position, html);
  return element === undefined || element.within.length > 0 ? undefined : decodeEntities(element.inner).trim();
}

/** Support pages send no Referer (donations contract section 2): the return from a payment carries identifiers in its address. */
export function noReferrerMeta(html: string, file: string): Finding[] {
  const metas = tagsOf(html).filter((tag) => !tag.closing && tag.name === 'meta' && (tag.attrs.get('name') ?? '').toLowerCase() === 'referrer');
  return metas.length === 1 && (metas[0]?.attrs.get('content') ?? '').toLowerCase() === 'no-referrer' ? [] : [err(file, 'the support page needs exactly one <meta name="referrer" content="no-referrer">')];
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
 * notice absent. Either way: the no-referrer meta, and no analytics beacon (the strict baseline of the support pages).
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
  if (found.state === 'open' && tagsOf(html).some((tag) => !tag.closing && tag.attrs.get('data-donations') === 'soon')) findings.push(err(file, 'the "soon" notice must go when donations are open'));
  findings.push(...noReferrerMeta(html, file));
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
  // Raw text, not tags: nothing to hide behind a quote or a comment. `data-donations` (and the panel marker) and a `Donations*.js`
  // script name are not words any other page has a reason to contain.
  const findings: Finding[] = [];
  if (/data-donations/i.test(html)) findings.push(err(file, 'data-donations belongs to the support pages only'));
  if (/Donations[^"'\s<>/\\]*\.js/i.test(html)) findings.push(err(file, 'a Donations script belongs to the support pages only'));
  return findings;
}
