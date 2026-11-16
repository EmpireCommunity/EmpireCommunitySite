# Update tracker, never built. Dependabot's docker ecosystem reads this FROM line and opens the update PR for the BuildKit
# builder image; release.yml (setup-buildx-action, driver-opts) must carry the same reference, and scripts/check-workflows.ts
# fails CI when the two differ. Bump both together, 2 weeks after the upstream release.
FROM moby/buildkit:v0.34.1@sha256:99368f3e46177c6405b9740e4461d91cee004128daeecca78d4ceac50ec1da5c
