#!/usr/bin/env bash
# Runs the relay image with the production hardening and no network, then checks the answers of members-json 2.11 that
# do not need Discord (scripts/lib/relay-probe.mjs): the process survives a failed fetch and stays healthy, 503 with no
# value, 404 for a query string or another path, 405 for another method, the fixed headers on every status. The 200
# answer with the Discord call replaced is covered by the relay's own tests in the normal test job.
# Usage: scripts/check-relay-run.sh <image-ref>
set -euo pipefail

image="${1:?usage: check-relay-run.sh <image-ref>}"
name="empirecommunity-relay-ci"
code="$(sed -n 's/^  inviteCode: //p' src/data/site.yaml | tr -d '"')"
status=0
trap 'docker rm -f "$name" > /dev/null 2>&1 || true' EXIT

# --network none: Discord cannot be reached, so the relay has no value and its first fetch fails.
docker run -d --name "$name" --read-only --cap-drop ALL --security-opt no-new-privileges:true --memory 64m --pids-limit 64 \
  --network none -e DISCORD_INVITE_CODE="$code" "$image" > /dev/null

ready=false
for _ in $(seq 1 20); do
  if docker exec "$name" wget -q -O /dev/null http://127.0.0.1:8080/healthz 2> /dev/null; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then docker logs "$name" 2>&1 | head -20; echo "::error::the relay did not answer /healthz"; exit 1; fi

# No published port with --network none: the probe runs inside the container with the Node it already has.
if ! out="$(docker exec -i "$name" node --input-type=module - < scripts/lib/relay-probe.mjs)"; then
  while IFS= read -r line; do echo "::error::$line"; done <<< "$out"
  status=1
fi
[ "$(docker inspect -f '{{.State.Running}}' "$name")" = "true" ] || { echo "::error::the relay exited after a failed fetch"; status=1; }
if docker logs "$name" 2>&1 | grep -qE '"?(GET|HEAD|POST) /'; then echo "::error::the relay wrote an access log line (D-20)"; status=1; fi
exit "$status"
