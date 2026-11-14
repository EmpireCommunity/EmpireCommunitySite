import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deriveTotals, formatBrl } from '../src/lib/support-rules.ts';
import { SupportSchema } from '../src/schemas/support.ts';

const both = (text: string) => ({ 'pt-br': text, 'en-us': text });
const part = { id: 'ram', name: both('RAM'), category: 'memory', quantity: 2, unitPriceCents: 50_000, status: 'purchased', acquiredOn: '2026-11-01' };
const support = {
  schemaVersion: 1,
  verified: { on: '2026-11-10', by: 'owner' },
  donations: { status: 'not-open' },
  goal: { id: 'xeon-server', title: both('Meta'), description: both('Texto'), targetCents: 300_000 },
  parts: [part],
};

describe('support schema (D-28)', () => {
  test('accepts the contract shape, with or without parts', () => {
    assert.equal(SupportSchema.safeParse(support).success, true);
    assert.equal(SupportSchema.safeParse({ ...support, parts: [] }).success, true);
    assert.equal(SupportSchema.safeParse({ ...support, donations: { status: 'open' } }).success, true, 'open is a valid state (P2-09)');
  });

  const rejected: [string, unknown][] = [
    ['a status that is neither not-open nor open', { ...support, donations: { status: 'opening' } }],
    ['an open status with a payment field', { ...support, donations: { status: 'open', gateway: 'x' } }],
    ['a Pix field', { ...support, pix: 'key' }],
    ['a payment field inside donations', { ...support, donations: { status: 'not-open', gateway: 'x' } }],
    ['no verified block', { ...support, verified: undefined }],
    ['a part without a Portuguese or English name', { ...support, parts: [{ ...part, name: { 'pt-br': 'RAM' } }] }],
    ['a purchased part without acquiredOn', { ...support, parts: [{ ...part, acquiredOn: undefined }] }],
    ['a needed part with acquiredOn', { ...support, parts: [{ ...part, status: 'needed' }] }],
    ['a fractional price', { ...support, parts: [{ ...part, unitPriceCents: 10.5 }] }],
    ['a zero goal', { ...support, goal: { ...support.goal, targetCents: 0 } }],
    ['duplicate part ids', { ...support, parts: [part, part] }],
  ];
  for (const [label, input] of rejected) {
    test(`rejects ${label}`, () => assert.equal(SupportSchema.safeParse(input).success, false));
  }
});

describe('support totals', () => {
  const parts = [
    { ...part, status: 'purchased' as const },
    { ...part, id: 'cpu', unitPriceCents: 100_000, quantity: 1, status: 'donated' as const },
    { ...part, id: 'psu', unitPriceCents: 90_000, quantity: 1, status: 'needed' as const, acquiredOn: undefined },
  ];

  test('counts only parts already bought or donated, as quantity x unit price', () => {
    assert.deepEqual(deriveTotals(parts as never, 300_000), { securedCents: 200_000, remainingCents: 100_000, progress: 200_000 / 300_000 });
  });

  test('caps at the goal and reaches zero remaining', () => {
    assert.deepEqual(deriveTotals(parts as never, 150_000), { securedCents: 200_000, remainingCents: 0, progress: 1 });
  });

  test('is zero with no parts', () => {
    assert.deepEqual(deriveTotals([], 300_000), { securedCents: 0, remainingCents: 300_000, progress: 0 });
  });
});

test('formats BRL as a currency per locale, with cents only when present', () => {
  // Intl writes a no-break space after "R$" in pt-BR.
  assert.equal(formatBrl(300_000, 'pt-br'), 'R$\u00a03.000');
  assert.equal(formatBrl(300_000, 'en-us'), 'R$3,000');
  assert.equal(formatBrl(123_450, 'pt-br'), 'R$\u00a01.234,50');
  assert.equal(formatBrl(123_450, 'en-us'), 'R$1,234.50');
});
