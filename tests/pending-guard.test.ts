import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blockingFlags } from '../scripts/lib/pending-guard.ts';

const flags = { discordPage: false, discoveryFiles: false, legalPages: true, membersFallback: false };

test('a final tag is blocked by any flag that is not false, legalPages included', () => {
  assert.deepEqual(blockingFlags(flags, false), ['legalPages']);
  assert.deepEqual(blockingFlags({ ...flags, discordPage: true }, false), ['discordPage', 'legalPages']);
});

test('a release candidate ignores legalPages and nothing else', () => {
  assert.deepEqual(blockingFlags(flags, true), []);
  assert.deepEqual(blockingFlags({ ...flags, membersFallback: true }, true), ['membersFallback']);
});

test('a flag that is not exactly the boolean false blocks, for both tag kinds', () => {
  assert.deepEqual(blockingFlags({ discordPage: 'false', discoveryFiles: 0, legalPages: false }, true), ['discordPage', 'discoveryFiles']);
  assert.deepEqual(blockingFlags({ legalPages: undefined }, false), ['legalPages']);
});
