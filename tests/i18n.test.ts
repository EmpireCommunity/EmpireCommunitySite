import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const load = (locale: string): Record<string, string> =>
  JSON.parse(readFileSync(new URL(`../src/i18n/messages/${locale}.json`, import.meta.url), 'utf8'));
const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();

const ptBr = load('pt-br');
const enUs = load('en-us');

test('both locales have the same keys (C-3)', () => {
  assert.deepEqual(Object.keys(enUs).sort(), Object.keys(ptBr).sort());
});

test('both locales use the same placeholders per key', () => {
  for (const [key, text] of Object.entries(ptBr)) {
    assert.deepEqual(placeholders(enUs[key] ?? ''), placeholders(text), key);
  }
});

test('no key mentions WhatsApp (site-data section 3)', () => {
  assert.equal(Object.keys(ptBr).some((key) => /whatsapp/i.test(key)), false);
});

test('every message is non-empty', () => {
  for (const messages of [ptBr, enUs]) {
    for (const [key, text] of Object.entries(messages)) assert.notEqual(text.trim(), '', key);
  }
});
