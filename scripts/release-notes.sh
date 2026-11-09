#!/usr/bin/env bash
# Prints the CHANGELOG section of a release version, and fails if it is missing, undated or empty.
# Usage: scripts/release-notes.sh X.Y.Z [CHANGELOG.md]
# Used by release.yml before anything is published, so a missing section never leaves a published image behind.
set -euo pipefail

version="${1:?usage: release-notes.sh X.Y.Z [CHANGELOG.md]}"
file="${2:-CHANGELOG.md}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "::error::'$version' is not X.Y.Z" >&2; exit 1; }

# Heading format: "## [X.Y.Z] - YYYY-MM-DD". The section ends at the next "## [" heading.
notes="$(awk -v v="$version" '
  BEGIN { head = "## [" v "] - " }
  index($0, head) == 1 {
    date = substr($0, length(head) + 1)
    if (date !~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/) exit 3
    found = 1; on = 1; next
  }
  on && /^## \[/ { exit }
  on { print }
  END { if (!found) exit 2 }
' "$file")" || {
  case $? in
    2) echo "::error::$file has no dated section '## [$version] - YYYY-MM-DD'." >&2 ;;
    *) echo "::error::the section heading of $version in $file has no valid date." >&2 ;;
  esac
  exit 1
}

if ! grep -q '[^[:space:]]' <<< "$notes"; then
  echo "::error::the [$version] section of $file is empty." >&2
  exit 1
fi
printf '%s\n' "$notes"
