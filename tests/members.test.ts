import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMembers, membersFromPayload } from '../src/lib/members.ts';

test('member count display rule (members-json section 3): exact below 100, rounded down to ten with a plus above', () => {
  const cases: [number, string, string][] = [
    [5, 'pt-BR', '5'],
    [99, 'en-US', '99'],
    [100, 'pt-BR', '100+'],
    [888, 'pt-BR', '880+'],
    [1234, 'pt-BR', '1.230+'],
    [1234, 'en-US', '1,230+'],
  ];
  for (const [n, lang, expected] of cases) assert.equal(formatMembers(n, lang), expected, `${n} ${lang}`);
});

test('a members.json body is accepted only when it matches schema 1; anything else keeps the built-in value', () => {
  const body = (discord: unknown, schema: unknown = 1) => ({ schema, discord });
  assert.equal(membersFromPayload(body({ members: 888, updatedAt: 'x', source: 'built-in', extra: true })), 888);
  const rejected: unknown[] = [
    null,
    'text',
    body({ members: 888 }, 2),
    body(null),
    body({}),
    body({ members: 12.5 }),
    body({ members: '888' }),
    body({ members: 0 }),
    body({ members: 1_000_001 }),
  ];
  for (const input of rejected) assert.equal(membersFromPayload(input), undefined, JSON.stringify(input));
});
