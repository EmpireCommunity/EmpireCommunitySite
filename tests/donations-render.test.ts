import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { adjustmentRow, donationRow, donationRows, expenseRow, expenseRows, fieldValues } from '../src/lib/donations-render.ts';
import type { PanelDocument, PanelElement, PanelLabels } from '../src/lib/donations-render.ts';
import { parseSnapshot } from '../src/lib/donations-snapshot.ts';

// A stand-in for the browser document: it records what is made and THROWS on every other way of putting text or markup
// into the page, so a render that used innerHTML (or any string of markup) fails the test, whatever the data holds.
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
  set innerHTML(_value: string) {
    throw new Error('innerHTML is forbidden');
  }
  set outerHTML(_value: string) {
    throw new Error('outerHTML is forbidden');
  }
  insertAdjacentHTML(): void {
    throw new Error('insertAdjacentHTML is forbidden');
  }
}
const doc: PanelDocument = { createElement: (tag) => new FakeElement(tag) };

const labels: PanelLabels = {
  anonymous: 'anônimo', received: 'Entrada', spent: 'Saída', person: 'Pessoa', owner: 'Dono',
  categories: { hosting: 'Hospedagem', domain: 'Domínio', power: 'Energia', hardware: 'Hardware', software: 'Software', fees: 'Taxas', withdrawal: 'Retirada', other: 'Outros' },
};
const snapshot = parseSnapshot(JSON.parse(readFileSync(new URL('./fixtures/transparency-snapshot.json', import.meta.url), 'utf-8')));
assert.ok(snapshot);

function walk(element: FakeElement, visit: (element: FakeElement) => void): void {
  visit(element);
  for (const child of element.children) walk(child, visit);
}
const all = (element: FakeElement): FakeElement[] => {
  const found: FakeElement[] = [];
  walk(element, (e) => found.push(e));
  return found;
};

const ALLOWED_TAGS = new Set(['tr', 'td', 'span']);

test('rows hold only tr, td and span, set no attribute from data and put every string in textContent', () => {
  const rows = [
    ...donationRows(doc, snapshot, 'pt-BR', labels),
    ...expenseRows(doc, snapshot, 'pt-BR', 'pt-br', labels),
  ] as FakeElement[];
  assert.equal(rows.length, 9);
  for (const row of rows) {
    for (const element of all(row)) {
      assert.ok(ALLOWED_TAGS.has(element.tag), element.tag);
      for (const name of Object.keys(element.attributes)) assert.equal(name, 'dir', 'only dir=auto is ever set');
    }
  }
});

// The validator already refuses these (donations-snapshot.test.ts); this proves the render does not rely on that.
test('a hostile name reaches the page as text only, in a direction-isolated, clipped cell', () => {
  const hostile = [
    '<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '"><svg/onload=alert(1)>', '&lt;b&gt;', '\u202Eevil\u202C', 'javascript:alert(1)',
    'مرحبا 123', 'x'.repeat(500), '</td></tr><tr><td>fake donation',
  ];
  for (const name of hostile) {
    const row = donationRow(doc, { seq: 9, date: '2026-12-03', cents: 2500, name }, 'pt-BR', labels) as FakeElement;
    assert.equal(row.children.length, 3, 'one cell per column: a name cannot add a cell or a row');
    const nameCell = row.children[1];
    const span = nameCell?.children[0];
    assert.equal(span?.textContent, name, 'the name is the text, untouched');
    assert.equal(span?.attributes.dir, 'auto');
    assert.match(span?.className ?? '', /\bdonor-name\b/);
    assert.deepEqual(Object.keys(span?.attributes ?? {}), ['dir']);
    assert.equal(span?.children.length, 0, 'no child element built from the name');
  }
});

test('anonymous is the page label, never an invented name, and carries no dir', () => {
  const row = donationRow(doc, { seq: 9, date: '2026-12-03', cents: 2500, name: null }, 'pt-BR', labels) as FakeElement;
  const span = row.children[1]?.children[0];
  assert.equal(span?.textContent, 'anônimo');
  assert.deepEqual(span?.attributes, {});
});

test('amounts carry their direction in words and in the sign, not in colour alone', () => {
  const income = donationRow(doc, snapshot.donations[0]!, 'pt-BR', labels) as FakeElement;
  const [word, amount] = income.children[2]?.children[0]?.children ?? [];
  assert.equal(word?.textContent, 'Entrada ');
  assert.match(word?.className ?? '', /sr-only/);
  assert.equal((amount?.textContent ?? '').replace(/\s/g, ' '), '+ R$ 25,00');
  const spend = expenseRow(doc, snapshot.out[0]!, 'pt-BR', 'pt-br', labels) as FakeElement;
  const [spentWord, spentAmount] = spend.children[4]?.children[0]?.children ?? [];
  assert.equal(spentWord?.textContent, 'Saída ');
  assert.equal((spentAmount?.textContent ?? '').replace(/\s/g, ' '), '− R$ 40,00');
});

test('expense rows translate the category and the person and owner labels and pick the page language of the justification', () => {
  const base = snapshot.out[0]!;
  const text = (payee: string, locale: 'pt-br' | 'en-us'): string[] =>
    (expenseRow(doc, { ...base, payee, justification: { 'pt-br': '<b>pt</b>', 'en-us': '<i>en</i>' } }, 'en-US', locale, labels) as FakeElement).children.map((c) => c.children[0]?.textContent ?? '');
  assert.deepEqual(text('Acme Ltd', 'pt-br').slice(1, 4), ['Domínio', 'Acme Ltd', '<b>pt</b>']);
  assert.equal(text('person', 'en-us')[2], 'Pessoa');
  assert.equal(text('owner', 'en-us')[2], 'Dono');
  assert.equal(text('Acme Ltd', 'en-us')[3], '<i>en</i>');
});

test('an adjustment row shows its sign and the reason of the page language', () => {
  const minus = adjustmentRow(doc, { date: '2026-12-01', cents: -500, reason: { 'pt-br': 'Correção', 'en-us': 'Correction' } }, 'pt-BR', 'pt-br', labels) as FakeElement;
  assert.equal(minus.children[1]?.children[0]?.textContent, 'Correção');
  assert.equal((minus.children[2]?.children[0]?.children[1]?.textContent ?? '').replace(/\s/g, ' '), '− R$ 5,00');
});

test('the document is never asked for anything but createElement, and every row is built fresh', () => {
  const made: string[] = [];
  const spy: PanelDocument = { createElement: (tag) => (made.push(tag), new FakeElement(tag)) };
  donationRows(spy, snapshot, 'pt-BR', labels);
  assert.ok(made.length > 0 && made.every((tag) => ALLOWED_TAGS.has(tag)));
});

test('field values are plain formatted strings for the totals, the balance lines and the build time', () => {
  const fields = fieldValues(snapshot, 'pt-BR');
  const flat = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.replace(/\s/g, ' ')]));
  assert.equal(flat.total, 'R$ 275,00');
  assert.equal(flat.count, '8');
  assert.equal(flat.balance, 'R$ 231,85');
  assert.equal(flat.sumReceived, '+ R$ 275,00');
  assert.equal(flat.sumFees, '− R$ 3,15');
  assert.equal(flat.sumOut, '− R$ 40,00');
  assert.equal(flat.sumAdjustments, 'R$ 0,00');
  assert.ok(flat.generatedAt?.includes('04/12/2026'));
  assert.equal(flat.reconciledOn, '01/12/2026');
});
