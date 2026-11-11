import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkWorkflow } from '../scripts/lib/workflow-rules.ts';

const workflow = (uses: string) => ({ on: 'push', permissions: {}, jobs: { call: { uses, permissions: {} } } });

test('a job-level reusable workflow must be pinned to a full commit SHA; local ones are allowed', () => {
  assert.equal(checkWorkflow('w.yml', workflow('octo/repo/.github/workflows/x.yml@main')).length, 1);
  assert.equal(checkWorkflow('w.yml', workflow('octo/repo/.github/workflows/x.yml@' + 'a'.repeat(40))).length, 0);
  assert.equal(checkWorkflow('w.yml', workflow('./.github/workflows/x.yml')).length, 0);
});
