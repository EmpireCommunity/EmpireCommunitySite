import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkBuildkitPin, trackerRefs } from '../scripts/lib/workflow-rules.ts';

const builder = 'moby/buildkit:v0.34.1@sha256:' + 'a'.repeat(64);
const generator = 'docker/buildkit-syft-scanner:1.12.1@sha256:' + 'd'.repeat(64);
const tracked = trackerRefs(`# comment\nFROM ${builder}\nFROM ${generator}\n`);
const sha = (name: string) => `docker/${name}@` + 'b'.repeat(40);
const workflow = (driverOpts?: string, sbom?: string | boolean) => ({
  jobs: {
    release: {
      steps: [
        { uses: sha('setup-buildx-action'), with: driverOpts === undefined ? {} : { 'driver-opts': driverOpts } },
        { uses: sha('build-push-action'), with: sbom === undefined ? {} : { sbom } },
      ],
    },
  },
});

test('the buildx builder and the SBOM generator must equal the references Dependabot tracks in .github/buildkit/Dockerfile', () => {
  assert.deepEqual(tracked, [builder, generator]);
  assert.equal(checkBuildkitPin('w.yml', workflow(`image=${builder}`, `generator=${generator}`), tracked).length, 0);
  assert.equal(checkBuildkitPin('w.yml', workflow(`image=${builder}`, false), tracked).length, 0);
  assert.equal(checkBuildkitPin('w.yml', workflow(`image=${builder}`), tracked).length, 0);
  assert.equal(checkBuildkitPin('w.yml', workflow('image=moby/buildkit:v0.35.0@sha256:' + 'c'.repeat(64), `generator=${generator}`), tracked).length, 1);
  assert.equal(checkBuildkitPin('w.yml', workflow(undefined, `generator=${generator}`), tracked).length, 1);
  assert.equal(checkBuildkitPin('w.yml', workflow(`image=${builder}`, true), tracked).length, 1);
  assert.equal(checkBuildkitPin('w.yml', workflow(`image=${builder}`, 'generator=docker/buildkit-syft-scanner:1.12.0@sha256:' + 'e'.repeat(64)), tracked).length, 1);
  assert.equal(checkBuildkitPin('w.yml', workflow(`image=${builder}`, `generator=${generator}`), []).length, 2);
});
