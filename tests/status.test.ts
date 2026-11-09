import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATUS_KIND, STATUS_LABEL, statusKind } from '../src/lib/status.ts';

test('schema status values map to the design record names', () => {
  assert.equal(statusKind('live'), 'live');
  assert.equal(statusKind('in-development'), 'development');
  assert.equal(statusKind('coming-soon'), 'soon');
});

test('every status has a label message and the mapping covers exactly the schema values', () => {
  assert.deepEqual(Object.keys(STATUS_KIND).sort(), ['coming-soon', 'in-development', 'live']);
  assert.deepEqual(STATUS_LABEL, { live: 'status.live', development: 'status.inDevelopment', soon: 'status.comingSoon' });
});
