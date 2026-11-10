import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { parse } from 'yaml';
import { formatRulesDate, inviteUrl } from '../src/lib/community-rules.ts';
import { CommunityRulesSchema } from '../src/schemas/community-rules.ts';

const both = (text: string) => ({ 'pt-br': text, 'en-us': text });
const rules = {
  updatedOn: '2025-02-27',
  rules: [{ id: 'spam', title: both('1 - Spam:'), body: both('Text') }],
};

describe('community rules schema (site-data section 14)', () => {
  test('the shipped file is valid', () => {
    const data: unknown = parse(readFileSync(new URL('../src/data/community-rules.yaml', import.meta.url), 'utf8'));
    assert.equal(CommunityRulesSchema.safeParse(data).success, true);
  });

  test('accepts the Terms URL as plain text', () => {
    const body = both('See\nhttps://discord.com/terms');
    assert.equal(CommunityRulesSchema.safeParse({ ...rules, rules: [{ ...rules.rules[0], body }] }).success, true);
  });

  const rejected: [string, unknown][] = [
    ['a missing translation', { ...rules, rules: [{ ...rules.rules[0], body: { 'pt-br': 'Texto' } }] }],
    ['an unknown key', { ...rules, link: 'https://discord.com/terms' }],
    ['no rules', { ...rules, rules: [] }],
    ['duplicate ids', { ...rules, rules: [rules.rules[0], rules.rules[0]] }],
    ['markup in a text', { ...rules, rules: [{ ...rules.rules[0], body: both('<b>x</b>') }] }],
    ['WhatsApp in a text', { ...rules, rules: [{ ...rules.rules[0], body: both('Use o WhatsApp') }] }],
    ['another Discord URL', { ...rules, rules: [{ ...rules.rules[0], body: both('https://discord.gg/abc') }] }],
    ['the Terms URL with trailing punctuation', { ...rules, rules: [{ ...rules.rules[0], body: both('https://discord.com/terms.') }] }],
    ['a date that does not exist', { ...rules, updatedOn: '2025-02-30' }],
  ];
  for (const [label, input] of rejected) {
    test(`rejects ${label}`, () => assert.equal(CommunityRulesSchema.safeParse(input).success, false));
  }
});

test('formats the rules date per locale and builds the invite from the code', () => {
  assert.equal(formatRulesDate('2025-02-27', 'pt-br'), '27 de fevereiro de 2025');
  assert.equal(formatRulesDate('2025-02-27', 'en-us'), 'February 27, 2025');
  assert.equal(inviteUrl('abc'), 'https://discord.com/invite/abc');
});
