# Update tracker, never built. Dependabot's docker ecosystem reads these two FROM lines and opens the update PR for the BuildKit
# builder image and for the SBOM generator image; release.yml must carry the same references (setup-buildx-action driver-opts for the
# builder, the `sbom: generator=...` input of every build-push-action that attaches an SBOM for the generator), and
# scripts/check-workflows.ts fails CI when they differ. Bump both together, 2 weeks after the upstream release (the Dependabot cooldown is 14 days).
# A Dependabot bump PR stays red in Workflow lint until release.yml is edited in the same PR: by design, so the pin never moves alone.
FROM moby/buildkit:v0.34.1@sha256:99368f3e46177c6405b9740e4461d91cee004128daeecca78d4ceac50ec1da5c
FROM docker/buildkit-syft-scanner:1.12.1@sha256:873a7458c3c8ac8e32c7b796c10e1600b07b963d2aa000a72a2d97aaaa2d6315
