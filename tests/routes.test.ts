import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROUTE_KEYS, routeKeyFromSlug, routePath, slugOf, xDefaultPath } from '../src/lib/routes.ts';

test('paths follow the routing contract and always end with a slash', () => {
  assert.equal(routePath('pt-br', 'home'), '/pt-br/');
  assert.equal(routePath('en-us', 'terms'), '/en-us/terms-of-service/');
  assert.equal(routePath('pt-br', 'discord'), '/pt-br/discord/');
  assert.equal(routePath('en-us', 'discord'), '/en-us/discord/');
  for (const key of ROUTE_KEYS) assert.match(routePath('pt-br', key), /^\/pt-br\/([a-z-]+\/)?$/);
});

test('slugs are identical in both locales, so the locale is the only difference', () => {
  for (const key of ROUTE_KEYS) {
    assert.equal(routePath('pt-br', key).replace('/pt-br/', '/en-us/'), routePath('en-us', key));
  }
});

test('x-default is the root on home and the en-US page on inner pages', () => {
  assert.equal(xDefaultPath('home'), '/');
  assert.equal(xDefaultPath('join'), '/en-us/join/');
});

test('slug lookup round-trips and rejects unknown slugs', () => {
  assert.equal(routeKeyFromSlug(slugOf('privacy')), 'privacy');
  assert.equal(routeKeyFromSlug('discord'), 'discord');
  assert.equal(routeKeyFromSlug('unknown'), undefined);
});
