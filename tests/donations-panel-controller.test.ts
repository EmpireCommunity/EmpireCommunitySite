import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FETCH_TIMEOUT_MS, MAX_BODY_CHARS, startPanel } from '../src/lib/donations-panel-controller.ts';
import type { FetchInit, PanelEnv, PanelNode, PanelResponse } from '../src/lib/donations-panel-controller.ts';
import type { PanelElement } from '../src/lib/donations-render.ts';
import { TRANSPARENCY_PATH } from '../src/lib/donations-snapshot.ts';

// The whole load, validate and show flow against a stand-in page, a stand-in `fetch` and a stand-in timer: deterministic,
// no network, no real clock. The stand-in page only knows the selectors the panel uses, so a selector change fails here.

class FakeElement implements PanelElement {
  readonly children: FakeElement[] = [];
  readonly attributes: Record<string, string> = {};
  className = '';
  textContent: string | null = null;
  readonly tag: string;
  constructor(tag: string) {
    this.tag = tag;
  }
  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }
  append(...children: PanelElement[]): void {
    this.children.push(...(children as FakeElement[]));
  }
}

class FakeNode implements PanelNode {
  hidden = true;
  textContent: string | null = null;
  readonly dataset: Record<string, string | undefined>;
  rows: PanelElement[] = [];
  readonly registry = new Map<string, FakeNode[]>();
  constructor(dataset: Record<string, string | undefined> = {}) {
    this.dataset = dataset;
  }
  child(selector: string): FakeNode {
    const node = new FakeNode();
    this.registry.set(selector, [...(this.registry.get(selector) ?? []), node]);
    return node;
  }
  querySelector(selector: string): FakeNode | null {
    return this.registry.get(selector)?.[0] ?? null;
  }
  querySelectorAll(selector: string): FakeNode[] {
    return this.registry.get(selector) ?? [];
  }
  replaceChildren(...rows: PanelElement[]): void {
    this.rows = rows;
  }
}

const LABELS = {
  labelAnonymous: 'anônimo', labelReceived: 'Entrada', labelSpent: 'Saída', labelPerson: 'Pessoa', labelOwner: 'Responsável', labelCorrected: 'corrigido',
  labelCategoryHosting: 'Hospedagem', labelCategoryDomain: 'Domínio', labelCategoryPower: 'Energia', labelCategoryHardware: 'Hardware',
  labelCategorySoftware: 'Software', labelCategoryFees: 'Taxas', labelCategoryWithdrawal: 'Retirada', labelCategoryOther: 'Outros',
};
const FIELDS = ['total', 'count', 'balance', 'sumReceived', 'sumFees', 'sumOut', 'sumAdjustments', 'voidedOut', 'voidedAdjustments', 'generatedAt', 'reconciledOn'];
const BLOCKS = ['donations', 'out', 'adjustments', 'adjustments-line', 'owner-note', 'reconciled', 'voided-out', 'voided-adjustments'];

function makePanel(dataset: Record<string, string | undefined> = LABELS) {
  const root = new FakeNode(dataset);
  const body = root.child('[data-panel-body]');
  const sentence = root.child('[data-panel-unavailable]');
  const rows = { donations: root.child('[data-rows="donations"]'), out: root.child('[data-rows="out"]'), adjustments: root.child('[data-rows="adjustments"]') };
  const blocks = Object.fromEntries(BLOCKS.map((name) => [name, root.child(`[data-block="${name}"]`)]));
  const fields = Object.fromEntries(FIELDS.map((name) => [name, root.child(`[data-field="${name}"]`)]));
  fields.balanceInBalanceBlock = root.child('[data-field="balance"]');
  return { root, body, sentence, rows, blocks, fields };
}

interface Run {
  fetched: { url: string; init: FetchInit; signal: AbortSignal }[];
  timers: { ms: number; cancelled: boolean; fire: () => void }[];
  env: PanelEnv;
}
type Answer = PanelResponse | Error | 'hang';

function makeEnv(answer: Answer, lang = 'pt-BR'): Run {
  const fetched: Run['fetched'] = [];
  const timers: Run['timers'] = [];
  const env: PanelEnv = {
    doc: { createElement: (tag) => new FakeElement(tag) },
    lang,
    fetch: (url, init) => {
      fetched.push({ url, init, signal: init.signal });
      if (answer instanceof Error) return Promise.reject(answer);
      if (answer === 'hang') {
        return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
      }
      return Promise.resolve(answer);
    },
    timer: (run, ms) => {
      const timer = { ms, cancelled: false, fire: run };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  };
  return { fetched, timers, env };
}

const fixture: Record<string, any> = JSON.parse(readFileSync(new URL('./fixtures/transparency-snapshot.json', import.meta.url), 'utf-8')); // eslint-disable-line @typescript-eslint/no-explicit-any
const reply = (text: string, headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' }, ok = true): PanelResponse => ({
  ok,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text: () => Promise.resolve(text),
});
const ok = (body: unknown): Answer => reply(JSON.stringify(body));
const edited = (edit: (snapshot: Record<string, any>) => void): Record<string, any> => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const copy = structuredClone(fixture);
  edit(copy);
  return copy;
};
const shown = (panel: ReturnType<typeof makePanel>): string =>
  JSON.stringify({ root: !panel.root.hidden, body: !panel.body.hidden, sentence: !panel.sentence.hidden });
const EMPTY = { root: false, body: false, sentence: false };
const SENTENCE = { root: true, body: false, sentence: true };
const SHOWN = { root: true, body: true, sentence: false };

test('no mount point: nothing runs, nothing is fetched', async () => {
  const run = makeEnv(ok(fixture));
  await startPanel(null, run.env);
  assert.equal(run.fetched.length, 0);
  assert.equal(run.timers.length, 0);
});

test('a missing label fails closed: no request and nothing shown', async () => {
  for (const missing of ['labelAnonymous', 'labelOwner', 'labelCorrected', 'labelCategoryDomain']) {
    const panel = makePanel({ ...LABELS, [missing]: undefined });
    const run = makeEnv(ok(fixture));
    await startPanel(panel.root, run.env);
    assert.equal(run.fetched.length, 0, missing);
    assert.equal(shown(panel), JSON.stringify(EMPTY), missing);
  }
});

test('a valid snapshot is shown, in both locales, with the page-language rows and fields', async () => {
  for (const [lang, expectedDate, expectedReason] of [['pt-BR', '03/12/2026', 'Renovação anual do domínio.'], ['en-US', '12/03/2026', 'Yearly domain renewal.']] as const) {
    const panel = makePanel();
    const run = makeEnv(ok(fixture), lang);
    await startPanel(panel.root, run.env);
    assert.equal(run.fetched.length, 1);
    assert.equal(run.fetched[0]?.url, TRANSPARENCY_PATH);
    assert.equal(shown(panel), JSON.stringify(SHOWN), lang);
    assert.equal(panel.rows.donations.rows.length, 8);
    assert.equal(panel.rows.out.rows.length, 1);
    assert.equal(panel.rows.adjustments.rows.length, 0);
    const firstDate = (panel.rows.donations.rows[0] as FakeElement).children[0]?.children[0]?.textContent;
    assert.equal(firstDate, expectedDate, lang);
    const reason = (panel.rows.out.rows[0] as FakeElement).children[3]?.children[0]?.textContent;
    assert.equal(reason, expectedReason, lang);
    assert.equal(panel.fields.count?.textContent, '8');
    assert.ok(panel.fields.generatedAt?.textContent?.includes('03:30'));
    assert.equal(panel.blocks.donations?.hidden, false);
    assert.equal(panel.blocks.adjustments?.hidden, true, 'no adjustments, no adjustments table');
    assert.equal(panel.blocks['adjustments-line']?.hidden, true);
    assert.equal(panel.blocks['owner-note']?.hidden, false, 'there is an expense, so the owner note shows');
    assert.equal(panel.blocks.reconciled?.hidden, false);
    assert.equal(panel.fields.voidedOut?.textContent, '1');
    assert.equal(panel.blocks['voided-out']?.hidden, false, 'the fixture has one withdrawn expense');
    assert.equal(panel.blocks['voided-adjustments']?.hidden, true, 'and no withdrawn adjustment');
  }
});

test('the request is made once, without credentials, and its timer is cancelled when the answer arrives', async () => {
  const panel = makePanel();
  const run = makeEnv(ok(fixture));
  await startPanel(panel.root, run.env);
  assert.equal(run.fetched.length, 1);
  assert.equal(run.timers.length, 1);
  assert.equal(run.timers[0]?.ms, FETCH_TIMEOUT_MS);
  assert.equal(run.timers[0]?.cancelled, true);
});

test('a valid snapshot with nothing in it leaves the panel hidden and shows no sentence', async () => {
  const empty = edited((s) => {
    s.received = { totalCents: 0, count: 0, feesCents: 0 };
    s.donations = [];
    s.out = [];
    s.balance = { calculatedCents: 0, reconciledOn: null };
    s.voided = { out: 0, adjustments: 0 };
  });
  const panel = makePanel();
  await startPanel(panel.root, makeEnv(ok(empty)).env);
  assert.equal(shown(panel), JSON.stringify(EMPTY));
});

test('every kind of failure ends in the one sentence and never in a body or a row', async () => {
  const failures: [string, Answer][] = [
    ['a 503', reply(JSON.stringify(fixture), { 'content-type': 'application/json' }, false)],
    ['an HTML answer (a proxy error page)', reply(JSON.stringify(fixture), { 'content-type': 'text/html' })],
    ['no content type', reply(JSON.stringify(fixture), {})],
    ['a JSON look-alike type', reply(JSON.stringify(fixture), { 'content-type': 'application/jsonp' })],
    ['a body over the size limit', reply(' '.repeat(MAX_BODY_CHARS + 1) + JSON.stringify(fixture))],
    ['a declared length over the limit', reply(JSON.stringify(fixture), { 'content-type': 'application/json', 'content-length': String(MAX_BODY_CHARS + 1) })],
    ['a rejected fetch', new Error('network down')],
    ['a body that is not JSON', reply('<html>not json')],
    ['an empty body', reply('')],
    ['JSON that is not a snapshot', ok({ hello: 'world' })],
    ['JSON null', ok(null)],
    ['a hostile display name', ok(edited((s) => { s.donations[1].name = '<img src=x onerror=alert(1)>'; }))],
    ['one malformed row among good ones', ok(edited((s) => { s.donations[5].cents = 'five'; }))],
    ['figures that do not add up', ok(edited((s) => { s.balance.calculatedCents += 1; }))],
  ];
  for (const [label, answer] of failures) {
    const panel = makePanel();
    await startPanel(panel.root, makeEnv(answer).env);
    assert.equal(shown(panel), JSON.stringify(SENTENCE), label);
    assert.equal(panel.rows.donations.rows.length, 0, `${label}: no partial list`);
    assert.equal(panel.rows.out.rows.length, 0, `${label}: no partial expenses`);
    assert.equal(panel.fields.total?.textContent, null, `${label}: no figure`);
  }
});

test('a 203 is a success: every 2xx answer goes on to validation', async () => {
  const panel = makePanel();
  await startPanel(panel.root, makeEnv(reply(JSON.stringify(fixture))).env);
  assert.equal(shown(panel), JSON.stringify(SHOWN));
});

test('a request that never answers is aborted by the timer and ends in the sentence', async () => {
  const panel = makePanel();
  const run = makeEnv('hang');
  const done = startPanel(panel.root, run.env);
  assert.equal(run.timers.length, 1);
  assert.equal(run.fetched[0]?.signal.aborted, false);
  run.timers[0]?.fire();
  await done;
  assert.equal(run.fetched[0]?.signal.aborted, true);
  assert.equal(shown(panel), JSON.stringify(SENTENCE));
  assert.equal(run.timers[0]?.cancelled, true, 'the timer is cleaned up on the failure path too');
});

test('the request is same-origin, carries no credentials and follows no redirect', async () => {
  const run = makeEnv(ok(fixture));
  await startPanel(makePanel().root, run.env);
  const { init } = run.fetched[0]!;
  assert.deepEqual({ ...init, signal: undefined }, { credentials: 'omit', cache: 'default', mode: 'same-origin', redirect: 'error', signal: undefined });
});

test('a declared length over the limit is refused without reading the body', async () => {
  let read = false;
  const response: PanelResponse = { ok: true, headers: { get: (name) => ({ 'content-type': 'application/json', 'content-length': String(MAX_BODY_CHARS + 1) })[name.toLowerCase()] ?? null }, text: () => ((read = true), Promise.resolve('{}')) };
  const panel = makePanel();
  await startPanel(panel.root, makeEnv(response).env);
  assert.equal(read, false);
  assert.equal(shown(panel), JSON.stringify(SENTENCE));
});

test('a body exactly at the limit is still parsed (and refused only if it is not a snapshot)', async () => {
  const padded = JSON.stringify(fixture).padEnd(MAX_BODY_CHARS, ' ');
  assert.equal(padded.length, MAX_BODY_CHARS);
  const panel = makePanel();
  await startPanel(panel.root, makeEnv(reply(padded)).env);
  assert.equal(shown(panel), JSON.stringify(SHOWN));
});

// The withdrawn counts (contract 6.13, drawn by P2-09): each line shows only when its own count is above 0, and a count above 0
// is public trace of real activity, so it keeps the section even when nothing else is listed.
const nothingListed = (s: Record<string, any>): void => { // eslint-disable-line @typescript-eslint/no-explicit-any
  s.received = { totalCents: 0, count: 0, feesCents: 0 };
  s.donations = [];
  s.out = [];
  s.adjustments = [];
  s.balance = { calculatedCents: 0, reconciledOn: null };
};

test('the withdrawn counts: each line follows its own count, and a count alone keeps the section', async () => {
  const cases: [string, Record<string, any>, { out: boolean; adjustments: boolean; section: boolean }, [string, string]][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    ['out 0, adjustments above 0', edited((s) => { s.voided = { out: 0, adjustments: 3 }; }), { out: false, adjustments: true, section: true }, ['0', '3']],
    ['both above 0', edited((s) => { s.voided = { out: 2, adjustments: 1200 }; }), { out: true, adjustments: true, section: true }, ['2', '1.200']],
    ['only out above 0, nothing else listed', edited((s) => { nothingListed(s); s.voided = { out: 4, adjustments: 0 }; }), { out: true, adjustments: false, section: true }, ['4', '0']],
    ['only adjustments above 0, nothing else listed', edited((s) => { nothingListed(s); s.voided = { out: 0, adjustments: 1 }; }), { out: false, adjustments: true, section: true }, ['0', '1']],
    ['both 0 on a listed history', edited((s) => { s.voided = { out: 0, adjustments: 0 }; }), { out: false, adjustments: false, section: true }, ['0', '0']],
    ['both 0 and nothing listed', edited((s) => { nothingListed(s); s.voided = { out: 0, adjustments: 0 }; }), { out: false, adjustments: false, section: false }, ['', '']],
  ];
  for (const [label, snapshot, expected, [voidedOut, voidedAdjustments]] of cases) {
    const panel = makePanel();
    await startPanel(panel.root, makeEnv(ok(snapshot)).env);
    assert.equal(shown(panel), JSON.stringify(expected.section ? SHOWN : EMPTY), `${label}: section`);
    assert.equal(panel.blocks['voided-out']?.hidden, !expected.out, `${label}: expenses line`);
    assert.equal(panel.blocks['voided-adjustments']?.hidden, !expected.adjustments, `${label}: adjustments line`);
    if (expected.section) {
      assert.equal(panel.fields.voidedOut?.textContent, voidedOut, `${label}: expenses count`);
      assert.equal(panel.fields.voidedAdjustments?.textContent, voidedAdjustments, `${label}: adjustments count`);
    }
  }
});

// A streamed body with no Content-Length (CodeRabbit): the bytes are counted as they arrive and the reader is cancelled at the limit,
// so the page never holds more than the limit and `text()` (which would read it all) is never called.
function streamed(chunks: Uint8Array[], headers: Record<string, string> = { 'content-type': 'application/json' }) {
  const log = { reads: 0, cancelled: false, textCalled: false };
  const response: PanelResponse = {
    ok: true,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: () => { log.textCalled = true; return Promise.resolve(''); },
    body: {
      getReader: () => ({
        read: () => { const value = chunks[log.reads]; log.reads += 1; return Promise.resolve(value === undefined ? { done: true as const, value: undefined } : { done: false as const, value }); },
        cancel: () => { log.cancelled = true; return Promise.resolve(); },
      }),
    },
  };
  return { log, response };
}

test('a streamed body with no length is bounded while it arrives, and a body split across chunks is decoded whole', async () => {
  const encoder = new TextEncoder();
  const overflow = streamed(Array.from({ length: 10 }, () => new Uint8Array(MAX_BODY_CHARS / 4 + 1)));
  const refused = makePanel();
  await startPanel(refused.root, makeEnv(overflow.response).env);
  assert.equal(shown(refused), JSON.stringify(SENTENCE));
  assert.equal(overflow.log.cancelled, true, 'the reader is cancelled at the limit');
  assert.equal(overflow.log.reads, 4, 'it stopped at the fourth chunk, the one that crossed the limit, not after all ten');
  assert.equal(overflow.log.textCalled, false);
  // The same snapshot cut in the middle of a multi-byte character still parses.
  const bytes = encoder.encode(JSON.stringify(edited((s) => { s.donations[1].name = 'João'; })));
  const cut = bytes.indexOf(0xc3) + 1;
  const whole = streamed([bytes.slice(0, cut), bytes.slice(cut)]);
  const panel = makePanel();
  await startPanel(panel.root, makeEnv(whole.response).env);
  assert.equal(shown(panel), JSON.stringify(SHOWN));
  assert.equal(whole.log.textCalled, false);
});
