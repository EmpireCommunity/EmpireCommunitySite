#!/usr/bin/env bash
# After a push: the image behind the pushed digest must be the one that passed the checks. Pulls <pushed-ref> (an
# image@sha256 reference) and compares its layer diff_ids and its config with the checked local image.
# Usage: scripts/check-pushed-image.sh <local-image> <pushed-ref>
set -euo pipefail

local_image="${1:?usage: check-pushed-image.sh <local-image> <pushed-ref>}"
pushed="${2:?usage: check-pushed-image.sh <local-image> <pushed-ref>}"
[[ "$pushed" =~ @sha256:[0-9a-f]{64}$ ]] || { echo "::error::the pushed reference must carry a digest: $pushed"; exit 1; }

docker pull --quiet --platform linux/amd64 "$pushed" > /dev/null
status=0
for field in RootFS.Layers Config; do
  if [ "$(docker image inspect "$local_image" --format "{{json .${field}}}")" != "$(docker image inspect "$pushed" --format "{{json .${field}}}")" ]; then
    echo "::error::${field} of ${pushed} differs from the checked image ${local_image}"
    status=1
  fi
done
exit "$status"
