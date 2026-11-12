import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isIntendedEdgeBlock } from '../scripts/lib/edge-block.ts';

const edge = { publicUrl: true, path: '/data/members.json?x=1', status: 403, server: 'cloudflare' };

test('the edge 403 on a members.json query is accepted at the public URL only', () => {
  assert.equal(isIntendedEdgeBlock(edge), true);
  assert.equal(isIntendedEdgeBlock({ ...edge, publicUrl: false }), false);
});

test('any other 403, path, status or server is still a failure', () => {
  assert.equal(isIntendedEdgeBlock({ ...edge, server: 'nginx' }), false);
  assert.equal(isIntendedEdgeBlock({ ...edge, server: null }), false);
  assert.equal(isIntendedEdgeBlock({ ...edge, path: '/pt-br/?x=1' }), false);
  assert.equal(isIntendedEdgeBlock({ ...edge, path: '/data/members.json' }), false);
  assert.equal(isIntendedEdgeBlock({ ...edge, status: 404 }), false);
});
