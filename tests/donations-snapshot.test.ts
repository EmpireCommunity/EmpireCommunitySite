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
    ['cents as a float', withEdit((s) => { s.donations[0].cents = 25.5; })],
    ['cents as a string', withEdit((s) => { s.donations[0].cents = '2500'; })],
    ['zero cents in a donation', withEdit((s) => { s.donations[0].cents = 0; })],
    ['a negative donation', withEdit((s) => { s.donations[0].cents = -2500; })],
    ['an unsafe integer', withEdit((s) => { s.received.totalCents = 2 ** 60; })],
    ['an unknown expense category', withEdit((s) => { s.out[0].category = 'party'; })],
    ['a justification missing one language', withEdit((s) => { delete s.out[0].justification['en-us']; })],
    ['a control character in a payee', withEdit((s) => { s.out[0].payee = 'Acme\nLtd'; })],
    ['a bidi override in a justification', withEdit((s) => { s.out[0].justification['pt-br'] = 'a‮b'; })],
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
    ['seq repeated', withEdit((s) => { s.donations[1].seq = 8; })],
    ['seq not newest first', withEdit((s) => { s.donations.reverse(); })],
  ];
  for (const [label, input] of bad) assert.equal(parseSnapshot(input), undefined, label);
  const adjusted = withEdit((s) => {
    s.adjustments = [{ date: '2026-12-01', cents: -500, reason: { 'pt-br': 'Correção.', 'en-us': 'Correction.' } }];
    s.balance.calculatedCents = 27500 - 315 - 4000 - 500;
  });
  assert.ok(parseSnapshot(adjusted), 'a signed adjustment that keeps the identity is accepted');
});

test('a gap in seq (a refund) is fine and a list longer than it shows (count above the rows) is fine', () => {
  const gap = withEdit((s) => {
    s.donations = s.donations.filter((d: { seq: number }) => d.seq !== 5);
    s.received = { totalCents: 27500 - 5000, count: 7, feesCents: 315 };
    s.balance.calculatedCents = 27500 - 5000 - 315 - 4000;
  });
  assert.ok(parseSnapshot(gap));
  const more = withEdit((s) => {
    s.received = { totalCents: 99000, count: 120, feesCents: 315 };
    s.balance.calculatedCents = 99000 - 315 - 4000;
  });
  assert.ok(parseSnapshot(more));
});

// Display names: the one field a stranger writes. Each of these is refused by the read side too (contract section 2).
test('hostile or disallowed display names fail validation, on any donation row', () => {
  const hostile = [
    '<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '"><svg/onload=alert(1)>', "';DROP TABLE donations;--",
    '‮evil', 'a‭b', 'zero​width', 'a⁦b⁩', 'line\nbreak', 'tab\there', ' leading', 'trailing ', '   ', '',
    '@admin', 'name.with.dot', 'a:b', 'a/b', 'https://x', 'emoji \u{1F600}', 'a'.repeat(21), '\uD800', 'x\u0000y',
    ' ', 'a b',
  ];
  for (const name of hostile) {
    assert.equal(isDisplayName(name), false, JSON.stringify(name));
    assert.equal(parseSnapshot(withEdit((s) => { s.donations[1].name = name; })), undefined, JSON.stringify(name));
  }
  assert.equal(parseSnapshot(withEdit((s) => { s.donations[1].name = 5; })), undefined, 'a number is not a name');
});

test('allowed display names pass: any script, digits, the allowed punctuation and graphemes counted not code units', () => {
  const ok = ['Maria', 'João 10', 'Ana-Clara', "O'Neil", 'a_b', 'Привет', '李小龍', 'مرحبا', 'é'.repeat(20), 'x'.repeat(20), 'á̂'];
  for (const name of ok) assert.equal(isDisplayName(name), true, name);
  assert.equal(isDisplayName('x'.repeat(21)), false);
  assert.equal(isDisplayName('é'.repeat(21)), false);
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
