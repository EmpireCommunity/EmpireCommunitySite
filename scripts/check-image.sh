#!/usr/bin/env bash
# Image rules of docs/contracts/deploy.md section 4. Usage: scripts/check-image.sh <image-ref>
# Inspects the built image and both base images; exits non-zero on any violation.
set -euo pipefail

image="${1:?usage: check-image.sh <image-ref>}"
status=0
fail() { echo "::error::$1"; status=1; }

# Base image references come from the Dockerfile, so the check cannot drift from what is built.
mapfile -t bases < <(sed -n 's/^ARG \(NODE_IMAGE\|NGINX_IMAGE\)=//p' Dockerfile)
[ "${#bases[@]}" -eq 2 ] || fail "Dockerfile must declare NODE_IMAGE and NGINX_IMAGE"
for base in "${bases[@]}"; do
  [[ "$base" =~ @sha256:[0-9a-f]{64}$ ]] || fail "base image is not pinned by digest: $base"
done

if grep -qiE '^[[:space:]]*LABEL.*traefik\.' Dockerfile; then fail "the Dockerfile has a traefik.* label"; fi

# Base images are pulled by digest so their labels can be read; an unreadable image is a failure, never a pass.
for base in "${bases[@]}"; do
  docker pull --quiet "$base" > /dev/null || fail "could not pull $base to inspect its labels"
done
for ref in "$image" "${bases[@]}"; do
  if ! labels="$(docker image inspect "$ref" --format '{{json .Config.Labels}}')"; then
    fail "could not inspect $ref"
  elif grep -qi '"traefik\.' <<< "$labels"; then
    fail "traefik.* label in the labels of $ref"
  fi
done

inspect() { docker image inspect "$image" --format "$1"; }
user="$(inspect '{{.Config.User}}')"
case "$user" in ''|0|root|0:*|root:*) fail "the image runs as root (User='${user}')" ;; esac
ports="$(inspect '{{range $p, $_ := .Config.ExposedPorts}}{{$p}} {{end}}')"
[ "${ports% }" = "8080/tcp" ] || fail "exposed ports must be exactly 8080/tcp, got: ${ports}"
volumes="$(inspect '{{json .Config.Volumes}}')"
case "$volumes" in null|'{}') ;; *) fail "the image declares a VOLUME: $volumes" ;; esac

# Content: dist/ and the nginx configuration only; no source, data files or Node.
if ! docker run --rm --entrypoint sh "$image" -c '
  for forbidden in /app /usr/src /src /usr/share/nginx/html/src /usr/local/bin/node /usr/bin/node; do
    [ ! -e "$forbidden" ] || { echo "present in the image: $forbidden"; exit 1; }
  done
  [ -f /usr/share/nginx/html/index.html ] || { echo "no index.html"; exit 1; }
  if find /usr/share/nginx/html -name "*.yaml" -o -name "*.yml" -o -name "*.ts" -o -name "*.astro" | grep -q .; then
    echo "source or data files in dist"; exit 1
  fi
'; then fail "unexpected content in the image"; fi

exit "$status"
