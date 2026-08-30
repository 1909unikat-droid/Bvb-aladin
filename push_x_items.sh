#!/bin/bash
# push_x_items.sh — veröffentlicht data/x_items.json via GitHub Contents-API.
# Publisher-Split wie bei rumors/injuries: nur der Mac hat die X-Session
# (Zweitaccount via Keychain), die Action-IPs haben keinen X-Zugang.
# Der Push triggert refresh-news.yml (push-Pfad data/x_items.json) — die
# Action baut news.json dann sofort mit den frischen X-Items.
#
# Gepusht wird nur bei Substanz-Änderung (Items-Signatur ohne Meta-Felder wie
# generated_at) — sonst würde jeder 7h-Lauf einen Vercel-Deploy kosten.
# Jeder Fehler ist non-fatal (exit 0) — der Refresh darf hieran nie scheitern.
set -uo pipefail
cd "$(dirname "$0")"

REPO="1909unikat-droid/Bvb-aladin"
BRANCH="main"
path="data/x_items.json"

[ -f "$path" ] || { echo "[x-push] $path fehlt — skip"; exit 0; }
command -v gh >/dev/null 2>&1 || { echo "[x-push] gh fehlt — skip"; exit 0; }

# Signatur = nur die Items (Meta wie generated_at/honest_note zählt nicht).
signatur() {
  python3 - "$1" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
print(json.dumps(d.get("items", []), sort_keys=True))
PY
}

remote_sha=$(gh api "repos/$REPO/contents/$path?ref=$BRANCH" -q .sha 2>/dev/null || echo "")

if [ -n "$remote_sha" ]; then
  sig_l=$(signatur "$path" 2>/dev/null) || { echo "[x-push] $path lokal unlesbar — skip"; exit 0; }
  remote_tmp=$(mktemp) || exit 0
  gh api "repos/$REPO/contents/$path?ref=$BRANCH" -H "Accept: application/vnd.github.raw" >"$remote_tmp" 2>/dev/null
  # Fail-closed wie push_rumors.sh: Remote existiert, aber Raw-Fetch klemmt →
  # nicht blind pushen, nächster Lauf versucht es wieder.
  sig_r=$(signatur "$remote_tmp" 2>/dev/null) || {
    rm -f "$remote_tmp"
    echo "[x-push] Remote-Fetch klemmt — skip (retry nächster Lauf)"; exit 0; }
  rm -f "$remote_tmp"
  if [ "$sig_l" = "$sig_r" ]; then
    echo "[x-push] $path inhaltlich unverändert — skip (kein Deploy)"
    exit 0
  fi
fi

b64=$(base64 < "$path" | tr -d '\n') || exit 0
if gh api -X PUT "repos/$REPO/contents/$path" \
    -f message="chore: x refresh $(date -u +%Y-%m-%dT%H:%MZ) [local]" \
    -f content="$b64" \
    -f branch="$BRANCH" \
    ${remote_sha:+-f sha="$remote_sha"} >/dev/null 2>&1; then
  echo "[x-push] $path -> $BRANCH ok"
else
  echo "[x-push] WARN: PUT $path fehlgeschlagen (Auth/Netz?) — skip"
fi
exit 0
