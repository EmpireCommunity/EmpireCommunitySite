#!/usr/bin/env bash
# Image rules of docs/contracts/deploy.md section 13 for the member-count relay. Usage: scripts/check-relay-image.sh <image-ref>
# Inspects the built image and its base; exits non-zero on any violation. The Dockerfile declares the base in
# `ARG NODE_IMAGE=` (same convention as the site Dockerfile): the official Node image, the major of .nvmrc, Alpine, by digest.
set -euo pipefail
export LC_ALL=C

image="${1:?usage: check-relay-image.sh <image-ref>}"
dockerfile="deploy/members-source/Dockerfile"
status=0
fail() { echo "::error::$1"; status=1; }

base="$(sed -n 's/^ARG NODE_IMAGE=//p' "$dockerfile")"
major="$(tr -d '[:space:]v' < .nvmrc | cut -d. -f1)"
[ "$(wc -l <<< "$base")" -eq 1 ] && [ -n "$base" ] || fail "$dockerfile must declare exactly one ARG NODE_IMAGE"
[[ "$base" =~ ^(docker\.io/library/)?node:${major}(\.[0-9]+)*-alpine[0-9.]*@sha256:[0-9a-f]{64}$ ]] \
  || fail "base must be the official node:${major} Alpine image pinned by digest, got: $base"
if grep -qiE '^[[:space:]]*LABEL.*traefik\.' "$dockerfile"; then fail "the Dockerfile has a traefik.* label"; fi
if grep -qE '^[[:space:]]*(ADD|RUN)[[:space:]].*(npm|pnpm|yarn|apk|corepack)' "$dockerfile"; then fail "the relay image adds no package install"; fi

docker pull --quiet "$base" > /dev/null || fail "could not pull $base to inspect it"
for ref in "$image" "$base"; do
  if ! labels="$(docker image inspect "$ref" --format '{{json .Config.Labels}}')"; then fail "could not inspect $ref"
  elif grep -qi '"traefik\.' <<< "$labels"; then fail "traefik.* label in the labels of $ref"; fi
done

inspect() { docker image inspect "$image" --format "$1"; }
user="$(inspect '{{.Config.User}}')"
case "$user" in ''|0|root|0:*|root:*) fail "the image runs as root (User='${user}')" ;; esac
ports="$(inspect '{{range $p, $_ := .Config.ExposedPorts}}{{$p}} {{end}}')"
[ "${ports% }" = "8080/tcp" ] || fail "exposed ports must be exactly 8080/tcp, got: ${ports}"
volumes="$(inspect '{{json .Config.Volumes}}')"
case "$volumes" in null|'{}') ;; *) fail "the image declares a VOLUME: $volumes" ;; esac

# Process settings: only Cmd differs from the base (the script it runs). Entrypoint, Env and WorkingDir are compared with the
# base as inspected, not with literals (NODE_VERSION moves with base bumps); Cmd is the one literal, so no flag such as
# `node --import data:...` or `-e` can enter through it without a file.
for field in Entrypoint Env WorkingDir; do
  [ "$(inspect "{{json .Config.${field}}}")" = "$(docker image inspect "$base" --format "{{json .Config.${field}}}")" ] \
    || fail "Config.${field} differs from the base image"
done
[ "$(inspect '{{json .Config.Cmd}}')" = '["node","/opt/members-source/relay.mjs"]' ] \
  || fail "Config.Cmd must be exactly [node, /opt/members-source/relay.mjs], got: $(inspect '{{json .Config.Cmd}}')"

# Content: the base image plus exactly one file (the relay script). Every file and symlink is listed with its hash (H),
# mode and owner (S) or link target (L), so a changed base file, a changed mode or owner, or a new symlink counts as an
# addition too. The three files Docker mounts into every container at run time are not part of the image.
listing() {
  docker run --rm --network none --entrypoint sh "$1" -c '
    find / -xdev -type f -exec sha256sum {} + 2>/dev/null | sed "s/^/H /"
    find / -xdev \( -type f -o -type l \) -exec stat -c "S %a %u:%g %n" {} + 2>/dev/null
    find / -xdev -type l -exec sh -c '\''for f; do echo "L $f -> $(readlink "$f")"; done'\'' sh {} + 2>/dev/null' | sort
}
pathof() { awk '{ if ($1 == "H") { sub(/^H [0-9a-f]+  /, "") } else if ($1 == "S") { sub(/^S [0-7]+ [0-9]+:[0-9]+ /, "") } else { sub(/^L /, ""); sub(/ -> .*$/, "") } print }'; }
changes="$(comm -13 <(listing "$base") <(listing "$image"))"
added="$(pathof <<< "$changes" | sort -u | grep -vxE '/etc/(hostname|hosts|resolv\.conf)' || true)"
count="$(grep -c . <<< "$added" || true)"
if [ "$count" -ne 1 ]; then fail "the image must add exactly one file, found ${count}: $(tr '\n' ' ' <<< "$added")"
elif ! [[ "$added" =~ \.(mjs|js)$ ]] || [[ "$added" =~ (package\.json|node_modules|\.ya?ml|\.ts|\.astro)$ ]]; then fail "the added file is not the relay script: $added"
elif grep -q '^L ' <<< "$changes"; then fail "the relay script must be a regular file, not a symlink: $added"
elif ! grep -qE "^S (644|444) 0:0 ${added//./\\.}$" <<< "$changes"; then fail "the relay script must be owned by root with mode 644 or 444: $(grep "^S .* ${added}$" <<< "$changes")"; fi

exit "$status"
