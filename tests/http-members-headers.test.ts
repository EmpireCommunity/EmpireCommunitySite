import assert from 'node:assert/strict';
import { test } from 'node:test';
import { membersAnswerSide, workerMembersProblems } from '../scripts/lib/members-headers.ts';

// MEMBERS-HDR: at the public URL, /data/members.json is checked against the side that answered (members-json 1 and 4).
const worker = { schema: 1, discord: { members: 912, updatedAt: '2026-11-16T00:00:00Z', source: 'discord' } };
const origin = { schema: 1, discord: { members: 880, updatedAt: '2026-11-15T00:00:00Z', source: 'built-in' } };
const workerHeaders = () => new Headers({
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600', 'x-content-type-options': 'nosniff', 'cf-cache-status': 'HIT',
});

test('the Worker branch: a body whose source is not built-in is the Worker, and its contract headers pass with no page headers', () => {
  assert.equal(membersAnswerSide(worker), 'worker');
  assert.deepEqual(workerMembersProblems(200, workerHeaders()), []);
});

test('the origin branch: source built-in is the origin fallback, checked with the origin headers as before', () => {
  assert.equal(membersAnswerSide(origin), 'origin');
});

test('a body that cannot be read is not taken for the origin file', () => {
  for (const body of [undefined, null, 'text', {}, { discord: null }, { discord: { source: 'BUILT-IN' } }]) assert.equal(membersAnswerSide(body), 'worker');
});

test('a Worker answer off its contract is reported, item by item', () => {
  const edge = workerHeaders(); edge.set('cache-control', 'public, max-age=14400'); // the zone Browser Cache TTL (B-CF-TTL)
  assert.deepEqual(workerMembersProblems(200, edge), ['Cache-Control is public, max-age=14400, expected public, max-age=600']);
  const loose = workerHeaders();
  loose.set('content-type', 'application/json'); loose.delete('x-content-type-options');
  loose.set('set-cookie', 'a=b'); loose.set('access-control-allow-origin', '*');
  assert.deepEqual(workerMembersProblems(500, loose), [
    'status 500, expected 200', 'Content-Type is application/json, expected application/json; charset=utf-8', 'X-Content-Type-Options is not nosniff',
    'Set-Cookie present', 'access-control-allow-origin present',
  ]);
});
