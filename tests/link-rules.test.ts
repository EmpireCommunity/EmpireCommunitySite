import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answers, inviteMatches, isPublicRepo, linkTargets, repoTargets } from '../scripts/lib/link-rules.ts';

const projects = [
  { id: 'a', url: 'https://muse.example.org', repo: 'Org/A' },
  { id: 'b', repo: 'Org/B' },
  { id: 'c', status: 'x' },
];
const site = { origin: 'https://example.org', links: { discord: 'https://example.org/discord', github: 'https://github.com/Org' } };

test('link targets are project urls and external site links, never pages of this site', () => {
  assert.deepEqual(linkTargets(projects, site), [
    { where: 'projects.yaml a', url: 'https://muse.example.org' },
    { where: 'site.yaml links.github', url: 'https://github.com/Org' },
  ]);
  assert.deepEqual(linkTargets([], { origin: 'https://example.org', links: { x: 'https://example.org.evil.test/' } }).length, 1);
});

test('a link named in linksNotLive is not probed', () => {
  const pending = { ...site, links: { ...site.links, cloud: 'https://status.example.net' }, linksNotLive: ['cloud'] };
  assert.deepEqual(linkTargets([], pending).map((target) => target.where), ['site.yaml links.github']);
  assert.equal(linkTargets([], { ...pending, linksNotLive: [] }).length, 2);
});

test('repo targets are the projects that carry a repo', () => {
  assert.deepEqual(repoTargets(projects).map((target) => target.repo), ['Org/A', 'Org/B']);
});

test('answers, public repository and invite decisions', () => {
  assert.deepEqual([199, 200, 301, 399, 400, 404].map(answers), [false, true, true, true, false, false]);
  assert.equal(isPublicRepo(200, { private: false }), true);
  assert.equal(isPublicRepo(200, { private: true }), false);
  assert.equal(isPublicRepo(404, null), false);
  assert.equal(inviteMatches({ code: 'abc', guild: { id: '1' } }, 'abc', '1'), true);
  assert.equal(inviteMatches({ code: 'abc', guild: { id: '2' } }, 'abc', '1'), false);
  assert.equal(inviteMatches({ code: 'zzz', guild: { id: '1' } }, 'abc', '1'), false);
  assert.equal(inviteMatches(null, 'abc', '1'), false);
});
