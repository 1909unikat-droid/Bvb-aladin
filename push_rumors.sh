#!/bin/bash
# push_rumors.sh — schiebt die lokal generierten Gerüchte-Dateien via GitHub
# Contents-API nach origin/main. Hintergrund: Transfermarkt blockt die
# GitHub-Actions-IPs (HTTP 202), der Mac (Residential-IP) bekommt 200 —
# also generiert der lokale launchd-Refresh die rumors.json und dieser
# Schritt veröffentlicht sie. Push nur bei inhaltlicher Änderung
# (Blob-SHA-Vergleich). Jeder Fehler ist non-fatal (exit 0) — der
# News-Refresh darf hieran nie scheitern.
set -uo pipefail
cd "$(dirname "$0")"

REPO="1909unikat-droid/Bvb-aladin"
BRANCH="main"

command -v gh >/dev/null 2>&1 || { echo "[rumors-push] gh fehlt — skip"; exit 0; }

push_file() {
  local path="$1"
  [ -f "$path" ] || { echo "[rumors-push] $path fehlt — skip"; return 0; }

  local local_sha remote_sha
  local_sha=$(git hash-object "$path" 2>/dev/null) || return 0
  remote_sha=$(gh api "repos/$REPO/contents/$path?ref=$BRANCH" -q .sha 2>/dev/null || echo "")

  if [ -n "$remote_sha" ] && [ "$local_sha" = "$remote_sha" ]; then
    echo "[rumors-push] $path unverändert — skip"
    return 0
  fi

  local b64
  b64=$(base64 < "$path" | tr -d '\n') || return 0

  if gh api -X PUT "repos/$REPO/contents/$path" \
      -f message="chore: rumors refresh $(date -u +%Y-%m-%dT%H:%MZ) [local]" \
      -f content="$b64" \
      -f branch="$BRANCH" \
      ${remote_sha:+-f sha="$remote_sha"} >/dev/null 2>&1; then
    echo "[rumors-push] $path -> $BRANCH ok"
  else
    echo "[rumors-push] WARN: PUT $path fehlgeschlagen (Auth/Netz?) — skip"
  fi
}

push_file "data/rumors.json"
push_file "web/public/data/rumors.json"
exit 0
