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

test('an SBOM job without a setup-buildx step, an attests input with type=sbom and a run step with another --sbom are refused', () => {
  const withSteps = (...steps: object[]) => ({ jobs: { release: { steps } } });
  const push = { uses: sha('build-push-action'), with: { sbom: `generator=${generator}` } };
  const buildx = { uses: sha('setup-buildx-action'), with: { 'driver-opts': `image=${builder}` } };
  assert.equal(checkBuildkitPin('w.yml', withSteps(buildx, push), tracked).length, 0);
  assert.equal(checkBuildkitPin('w.yml', withSteps(push), tracked).length, 1);
  assert.equal(checkBuildkitPin('w.yml', withSteps(buildx, { uses: sha('build-push-action'), with: { sbom: false, attests: 'type=sbom' } }), tracked).length, 1);
  assert.equal(checkBuildkitPin('w.yml', withSteps(buildx, { run: 'docker buildx build --push --sbom=true .' }), tracked).length, 1);
  assert.equal(checkBuildkitPin('w.yml', withSteps(buildx, { run: `docker buildx build --sbom=generator=${generator} .` }), tracked).length, 0);
  assert.equal(checkBuildkitPin('w.yml', withSteps(buildx, { run: 'docker buildx build --load --sbom=false .' }), tracked).length, 0);
});
