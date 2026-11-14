import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  MAX_LISTED_DONATIONS, balanceHolds, formatCents, formatDay, formatGeneratedAt, formatSigned, hasData, isDisplayName, parseSnapshot,
} from '../src/lib/donations-snapshot.ts';

// A snapshot shaped like the contract's (donations contract section 6, schema 2), with synthetic values only.
const fixture: Record<string, unknown> = JSON.parse(readFileSync(new URL('./fixtures/transparency-snapshot.json', import.meta.url), 'utf-8'));
const clone = (): Record<string, any> => structuredClone(fixture); // eslint-disable-line @typescript-eslint/no-explicit-any
const withEdit = (edit: (snapshot: Record<string, any>) => void): unknown => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const snapshot = clone();
  edit(snapshot);
  return snapshot;
};

// The latest 100 donations of a history of `count` donations (500 cents each), with the given grand total.
const hundred = (count: number, totalCents: number): Record<string, unknown> => ({
  received: { totalCents, count, feesCents: 315 },
  donations: Array.from({ length: 100 }, (_, i) => ({ seq: count - i, date: '2026-12-01', cents: 500, name: null })),
  balance: { calculatedCents: totalCents - 315 - 4000, reconciledOn: '2026-12-01' },
});

test('the contract-shaped fixture is accepted and keeps every field', () => {
  const snapshot = parseSnapshot(fixture);
  assert.ok(snapshot);
  assert.equal(snapshot.received.count, 8);
  assert.equal(snapshot.donations.length, 8);
  assert.equal(snapshot.donations[0]?.name, null);
  assert.equal(snapshot.donations[1]?.name, 'Example A');
  assert.equal(snapshot.out[0]?.justification['en-us'], 'Yearly domain renewal.');
  assert.ok(balanceHolds(snapshot));
  assert.ok(hasData(snapshot));
});

test('the last second of a real day is a valid generatedAt', () => {
  assert.ok(parseSnapshot(withEdit((s) => { s.generatedAt = '2026-12-31T23:59:59.999Z'; })));
  assert.ok(parseSnapshot(withEdit((s) => { s.generatedAt = '2028-02-29T00:00:00Z'; })), 'a leap day');
});

test('an empty but valid snapshot has no data to show', () => {
  const empty = withEdit((s) => {
    s.received = { totalCents: 0, count: 0, feesCents: 0 };
    s.donations = [];
    s.out = [];
    s.balance = { calculatedCents: 0, reconciledOn: null };
  });
  const snapshot = parseSnapshot(empty);
  assert.ok(snapshot);
  assert.equal(hasData(snapshot), false);
});

test('anything that is not exactly the schema is refused whole (fail closed)', () => {
  const bad: [string, unknown][] = [
    ['not an object', 'x'], ['null', null], ['an array', []],
    ['schema 1', withEdit((s) => { s.schema = 1; })],
    ['schema as a string', withEdit((s) => { s.schema = '2'; })],
    ['an extra top-level key', withEdit((s) => { s.extra = 1; })],
    ['a missing section', withEdit((s) => { delete s.audit; })],
    ['an extra key in a donation', withEdit((s) => { s.donations[0].method = 'pix'; })],
    ['a payer field in a donation', withEdit((s) => { s.donations[0].payer = 'x'; })],
    ['a time of day in a donation date', withEdit((s) => { s.donations[0].date = '2026-12-03T10:00:00Z'; })],
    ['an impossible day', withEdit((s) => { s.donations[0].date = '2026-02-30'; })],
    ['generatedAt without a zone', withEdit((s) => { s.generatedAt = '2026-12-04T06:30:00'; })],
    ['generatedAt on an impossible day', withEdit((s) => { s.generatedAt = '2026-02-30T06:30:00.000Z'; })],
    ['generatedAt in a month 13', withEdit((s) => { s.generatedAt = '2026-13-01T06:30:00Z'; })],
    ['generatedAt at hour 24', withEdit((s) => { s.generatedAt = '2026-12-04T24:00:00Z'; })],
    ['generatedAt at minute 60', withEdit((s) => { s.generatedAt = '2026-12-04T06:60:00Z'; })],
    ['cents as a float', withEdit((s) => { s.donations[0].cents = 25.5; })],
    ['cents as a string', withEdit((s) => { s.donations[0].cents = '2500'; })],
    ['zero cents in a donation', withEdit((s) => { s.donations[0].cents = 0; })],
    ['a negative donation', withEdit((s) => { s.donations[0].cents = -2500; })],
    ['an unsafe integer', withEdit((s) => { s.received.totalCents = 2 ** 60; })],
    ['an unknown expense category', withEdit((s) => { s.out[0].category = 'party'; })],
    ['a justification missing one language', withEdit((s) => { delete s.out[0].justification['en-us']; })],
    ['a control character in a payee', withEdit((s) => { s.out[0].payee = 'Acme\nLtd'; })],
    ['a bidi override in a justification', withEdit((s) => { s.out[0].justification['pt-br'] = 'a\u202Eb'; })],
    ['a source label that is not a plain word', withEdit((s) => { s.sources.received = 'Mercado Pago <b>'; })],
    ['a source that is not text', withEdit((s) => { s.sources.received = 5; })],
    ['owner-declared sections attributed elsewhere', withEdit((s) => { s.sources.out = 'calculated'; })],
    ['the balance not marked as calculated', withEdit((s) => { s.sources.balance = 'owner'; })],
    ['a non-hex audit head', withEdit((s) => { s.audit.head = 'zz'.repeat(20); })],
    ['more than the latest 100 donations', withEdit((s) => {
      s.donations = Array.from({ length: MAX_LISTED_DONATIONS + 1 }, (_, i) => ({ seq: 200 - i, date: '2026-12-01', cents: 500, name: null }));
      s.received = { totalCents: 500 * 101, count: 101, feesCents: 0 };
      s.balance.calculatedCents = 500 * 101 - 4000;
    })],
  ];
  for (const [label, input] of bad) assert.equal(parseSnapshot(input), undefined, label);
});

test('figures that do not add up are refused: balance identity, listed totals, seq order, count', () => {
  const bad: [string, unknown][] = [
    ['balance off by a cent', withEdit((s) => { s.balance.calculatedCents += 1; })],
    ['fees not in the balance', withEdit((s) => { s.received.feesCents += 5; })],
    ['an expense not in the balance', withEdit((s) => { s.out[0].cents += 5; })],
    ['total different from the listed sum when the list is the whole history', withEdit((s) => { s.received.totalCents += 100; s.balance.calculatedCents += 100; })],
    ['count lower than the listed rows', withEdit((s) => { s.received.count = 7; })],
    ['count above the rows when nothing was truncated', withEdit((s) => { s.received.count = 5; s.donations = s.donations.slice(0, 3); s.received.totalCents = 13500; s.balance.calculatedCents = 13500 - 315 - 4000; })],
    ['a count with an empty list', withEdit((s) => { s.donations = []; })],
    ['seq repeated', withEdit((s) => { s.donations[1].seq = 8; })],
    ['seq not newest first', withEdit((s) => { s.donations.reverse(); })],
    ['a total below the listed donations when the list is only part of the history', withEdit((s) => { Object.assign(s, hundred(120, 1)); })],
    ['more history than 100 rows but a short list', withEdit((s) => { s.received = { totalCents: 99000, count: 120, feesCents: 315 }; s.balance.calculatedCents = 99000 - 315 - 4000; })],
  ];
  for (const [label, input] of bad) assert.equal(parseSnapshot(input), undefined, label);
  const adjusted = withEdit((s) => {
    s.adjustments = [{ date: '2026-12-01', cents: -500, reason: { 'pt-br': 'Correção.', 'en-us': 'Correction.' } }];
    s.balance.calculatedCents = 27500 - 315 - 4000 - 500;
  });
  assert.ok(parseSnapshot(adjusted), 'a signed adjustment that keeps the identity is accepted');
  const zero = withEdit((s) => { s.adjustments = [{ date: '2026-12-01', cents: 0, reason: { 'pt-br': 'Conferido.', 'en-us': 'Checked.' } }]; });
  assert.ok(parseSnapshot(zero), 'a zero-cent adjustment does not hide the panel');
  assert.equal(parseSnapshot(withEdit((s) => { s.adjustments = [{ date: '2026-12-01', cents: 0.5, reason: { 'pt-br': 'a', 'en-us': 'a' } }]; })), undefined, 'cents stay integers');
});

test('a gap in seq (a refund) is fine and a list longer than it shows (count above the rows) is fine', () => {
  const gap = withEdit((s) => {
    s.donations = s.donations.filter((d: { seq: number }) => d.seq !== 5);
    s.received = { totalCents: 27500 - 5000, count: 7, feesCents: 315 };
    s.balance.calculatedCents = 27500 - 5000 - 315 - 4000;
  });
  assert.ok(parseSnapshot(gap));
  assert.ok(parseSnapshot(withEdit((s) => { Object.assign(s, hundred(120, 60000)); })), 'the latest 100 rows of a longer history');
  assert.ok(parseSnapshot(withEdit((s) => { Object.assign(s, hundred(100, 50000)); })), 'exactly 100 rows, all of the history');
});

// Display names: the one field a stranger writes. Each of these is refused by the read side too (contract section 2).
test('hostile or disallowed display names fail validation, on any donation row', () => {
  const hostile = [
    '<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '"><svg/onload=alert(1)>', "';DROP TABLE donations;--",
    '\u202Eevil', 'a\u202Db', 'zero\u200Bwidth', 'a\u2066b\u2069', 'line\nbreak', 'tab\there', ' leading', 'trailing ', '   ', '',
    '@admin', 'name.with.dot', 'a:b', 'a/b', 'https://x', 'emoji \u{1F600}', 'a'.repeat(21), '\uD800', 'x\u0000y',
    '\u2028', 'a\u2029b',
    'P\u0430ypal', 'Ivan \u0418\u0432\u0430\u043D', 'a\u03B1', '\u0561b', '\u13A0b', '\u3055\u304F\u3089\u6851', '\u30AB\u3042', 'x\u00B2', '\u00BD', 'Maria \u216B', 'a\u2460', '12345', '11 9 8765 4321', 'a1b2c3d4e5',
  ];
  for (const name of hostile) {
    assert.equal(isDisplayName(name), false, JSON.stringify(name));
    assert.equal(parseSnapshot(withEdit((s) => { s.donations[1].name = name; })), undefined, JSON.stringify(name));
  }
  assert.equal(parseSnapshot(withEdit((s) => { s.donations[1].name = 5; })), undefined, 'a number is not a name');
});

test('allowed display names pass: any script, digits, the allowed punctuation and graphemes counted not code units', () => {
  const ok = ['\u0440\u0456\u0445', '\u03B1\u03B2\u03B3', '\u3055\u304F\u3089', '\u30AB\u30BF\u30AB\u30CA', '\u6851\u6821', 'Jo\u00E3o 10 Silva', 'Ana 2026 \u00C7a', 'Jos\u00E9 \u00C9mile', '1234', 'Ana 2026', '\u0661\u0662\u0663', 'Maria', 'João 10', 'Ana-Clara', "O'Neil", 'a_b', 'Привет', '李小龍', 'مرحبا', 'e\u0301'.repeat(20), 'x'.repeat(20), 'a\u0301\u0302'];
  for (const name of ok) assert.equal(isDisplayName(name), true, name);
  assert.equal(isDisplayName('x'.repeat(21)), false);
  assert.equal(isDisplayName('e\u0301'.repeat(21)), false);
  assert.equal(isDisplayName('a\u0301\u0302\u0303'), false, 'three combining marks in one grapheme (contract G2)');
  assert.equal(isDisplayName('a' + '\u0301'.repeat(160)), false, 'a stack of marks is refused by the marks rule, not by a code-unit cap');
});

test('without Intl.Segmenter (older browsers) names are still counted by base character, marks joined to the one before', () => {
  const original = Intl.Segmenter;
  Reflect.deleteProperty(Intl, 'Segmenter');
  try {
    assert.equal(typeof Intl.Segmenter, 'undefined');
    assert.equal(isDisplayName('e\u0301'.repeat(20)), true, '20 base characters with a mark each');
    assert.equal(isDisplayName('e\u0301'.repeat(21)), false);
    assert.equal(isDisplayName('a\u0301\u0302\u0303'), false);
  } finally {
    Reflect.defineProperty(Intl, 'Segmenter', { value: original, configurable: true, writable: true });
  }
  assert.equal(typeof Intl.Segmenter, 'function');
});

test('money, day and time formatting follow the page language and never read the clock', () => {
  assert.equal(formatCents(538499, 'pt-BR').replace(/\s/g, ' '), 'R$ 5.384,99');
  assert.equal(formatCents(538499, 'en-US'), 'R$5,384.99');
  assert.equal(formatSigned(2500, 'pt-BR', 'in').replace(/\s/g, ' '), '+ R$ 25,00');
  assert.equal(formatSigned(4000, 'en-US', 'out'), '− R$40.00');
  assert.equal(formatDay('2026-12-03', 'pt-BR'), '03/12/2026');
  assert.equal(formatDay('2026-12-03', 'en-US'), '12/03/2026');
  const sampa = formatGeneratedAt('2026-12-04T06:30:00.000Z', 'pt-BR');
  assert.ok(sampa.includes('04/12/2026') && sampa.includes('03:30'), sampa);
});
