import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkBuildkitPin, trackerRef } from '../scripts/lib/workflow-rules.ts';

const ref = 'moby/buildkit:v0.34.1@sha256:' + 'a'.repeat(64);
const workflow = (driverOpts?: string) => ({
  jobs: { release: { steps: [{ uses: 'docker/setup-buildx-action@' + 'b'.repeat(40), with: driverOpts === undefined ? {} : { 'driver-opts': driverOpts } }] } },
});

test('the buildx builder image must equal the reference Dependabot tracks in .github/buildkit/Dockerfile', () => {
  const tracked = trackerRef(`# comment\nFROM ${ref}\n`);
  assert.equal(tracked, ref);
  assert.equal(checkBuildkitPin('w.yml', workflow(`image=${ref}`), tracked).length, 0);
  assert.equal(checkBuildkitPin('w.yml', workflow('image=moby/buildkit:v0.35.0@sha256:' + 'c'.repeat(64)), tracked).length, 1);
  assert.equal(checkBuildkitPin('w.yml', workflow(), tracked).length, 1);
  assert.equal(checkBuildkitPin('w.yml', workflow(`image=${ref}`), undefined).length, 1);
});
