import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isIntendedEdgeBlock } from '../scripts/lib/edge-block.ts';

const edge = { publicUrl: true, path: '/data/members.json?x=1', status: 403, hasContractCsp: false };

test('the edge 403 on a members.json query is accepted at the public URL only', () => {
  assert.equal(isIntendedEdgeBlock(edge), true);
  assert.equal(isIntendedEdgeBlock({ ...edge, publicUrl: false }), false);
});

test('any other 403 (one carrying the origin's contract CSP included), path or status is still a failure', () => {
  assert.equal(isIntendedEdgeBlock({ ...edge, hasContractCsp: true }), false);
  assert.equal(isIntendedEdgeBlock({ ...edge, path: '/pt-br/?x=1' }), false);
  assert.equal(isIntendedEdgeBlock({ ...edge, path: '/data/members.json' }), false);
  assert.equal(isIntendedEdgeBlock({ ...edge, status: 404 }), false);
});
