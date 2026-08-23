#!/bin/bash
# push_rumors.sh — schiebt die lokal generierten Zusatz-Dateien (Gerüchte,
# Verletzungen) via GitHub Contents-API nach origin/main.
# Hintergrund: Transfermarkt blockt die GitHub-Actions-IPs (HTTP 202), der
# Mac (Residential-IP) bekommt 200 — also generiert der lokale
# launchd-Refresh diese Dateien und dieser Schritt veröffentlicht sie.
#
# Deploy-Budget (Vercel Hobby: 100 Deploys/Tag, JEDER Commit = 1 Deploy):
#   - Gepusht wird nur web/public/data/* — nur das serviert Vercel. Die
#     Root-Kopien data/*.json bleiben lokal aktuell (halbiert die Commits).
#   - vibe_history.json wird hier NICHT gepusht: die publiziert die GitHub
#     Action gebündelt mit news.json (kein Extra-Deploy, Tages-Granularität
#     reicht der Sparkline).
#   - squad.json + squad_2026.json laufen höchstens 1x/Tag durch den Fetcher
#     (Tageslimit in run_refresh.sh) — also maximal 2 Deploys/Tag, und auch
#     die nur bei echter Kader-Änderung. Kein Eintrag in VOLATILE: marketValue
#     ist bei TM keine Pro-Scrape-Jitter-Größe, sondern genau die Substanz,
#     die die Kader-Seite anzeigt (und rumors.json führt dasselbe Feld).
#   - Volatile Felder (tmProbability jittert pro TM-Scrape um ±1, sources/
#     lastMention wandern mit dem rollenden News-Fenster) zählen NICHT als
#     inhaltliche Änderung — sonst pusht fast jeder 30-min-Lauf (gemessen
#     13.08.: 78 von 98 Commits waren solche Schein-Änderungen). Substanz
#     (Spieler/Verein/Richtung/Zehner-Wahrscheinlichkeit) pusht sofort,
#     reiner Drift höchstens alle 6 h.
#
# Jeder Fehler ist non-fatal (exit 0) — der News-Refresh darf hieran nie
# scheitern.
set -uo pipefail
cd "$(dirname "$0")"

REPO="1909unikat-droid/Bvb-aladin"
BRANCH="main"
DRIFT_INTERVAL_S=21600  # 6h
STATE_DIR="data/.push_state"
mkdir -p "$STATE_DIR" 2>/dev/null

command -v gh >/dev/null 2>&1 || { echo "[rumors-push] gh fehlt — skip"; exit 0; }

# Gibt zwei Zeilen aus: Zeile 1 = Signatur (ohne volatile Felder),
# Zeile 2 = Norm (nur Timestamps entfernt). Arg: Dateipfad.
# ACHTUNG: bewusst KEIN stdin-Modus — das Heredoc belegt bereits stdin
# des python3-Aufrufs (gepipte Daten kämen nie an, JSON-Parse fiele
# immer fehl → fail-closed hätte ALLE Pushes blockiert; live gesehen
# am 14.08. 18:53Z).
normalize() {
  python3 - "$1" <<'PY'
import json, sys

VOLATILE = {"probability", "tmProbability", "lastMention", "sources"}
TIMESTAMPS = {"generated_at", "updated_at"}

def strip(obj, keys):
    if isinstance(obj, dict):
        return {k: strip(v, keys) for k, v in obj.items() if k not in keys}
    if isinstance(obj, list):
        return [strip(v, keys) for v in obj]
    return obj

with open(sys.argv[1]) as src:
    d = json.load(src)
print(json.dumps(strip(d, TIMESTAMPS | VOLATILE), sort_keys=True))
print(json.dumps(strip(d, TIMESTAMPS), sort_keys=True))
PY
}

push_file() {
  local path="$1"
  [ -f "$path" ] || { echo "[rumors-push] $path fehlt — skip"; return 0; }

  local state_file="$STATE_DIR/$(basename "$path").last_push"
  local remote_sha
  remote_sha=$(gh api "repos/$REPO/contents/$path?ref=$BRANCH" -q .sha 2>/dev/null || echo "")

  if [ -n "$remote_sha" ]; then
    local local_out remote_tmp remote_out
    local_out=$(normalize "$path" 2>/dev/null) || { echo "[rumors-push] $path lokal unlesbar — skip"; return 0; }
    remote_tmp=$(mktemp) || return 0
    gh api "repos/$REPO/contents/$path?ref=$BRANCH" -H "Accept: application/vnd.github.raw" >"$remote_tmp" 2>/dev/null
    # Fail-closed: Remote existiert (sha da), aber Raw-Fetch klemmt → nicht
    # blind pushen, nächster Lauf versucht es wieder.
    remote_out=$(normalize "$remote_tmp" 2>/dev/null) || {
      rm -f "$remote_tmp"
      echo "[rumors-push] $path Remote-Fetch klemmt — skip (retry nächster Lauf)"; return 0; }
    rm -f "$remote_tmp"

    local sig_l norm_l sig_r norm_r
    sig_l=$(sed -n 1p <<<"$local_out");  norm_l=$(sed -n 2p <<<"$local_out")
    sig_r=$(sed -n 1p <<<"$remote_out"); norm_r=$(sed -n 2p <<<"$remote_out")

    if [ "$sig_l" = "$sig_r" ]; then
      if [ "$norm_l" = "$norm_r" ]; then
        echo "[rumors-push] $path inhaltlich unverändert — skip (kein Deploy)"
        return 0
      fi
      # Nur volatiler Drift: höchstens alle DRIFT_INTERVAL_S pushen.
      local now last
      now=$(date +%s)
      last=$(cat "$state_file" 2>/dev/null || echo 0)
      if [ $((now - last)) -lt "$DRIFT_INTERVAL_S" ]; then
        echo "[rumors-push] $path nur Drift, letzter Push <6h — skip (kein Deploy)"
        return 0
      fi
      echo "[rumors-push] $path Drift-Sammelpush (>6h)"
    else
      echo "[rumors-push] $path Substanz-Änderung — push"
    fi
  fi

  local b64
  b64=$(base64 < "$path" | tr -d '\n') || return 0

  if gh api -X PUT "repos/$REPO/contents/$path" \
      -f message="chore: $(basename "$path" .json) refresh $(date -u +%Y-%m-%dT%H:%MZ) [local]" \
      -f content="$b64" \
      -f branch="$BRANCH" \
      ${remote_sha:+-f sha="$remote_sha"} >/dev/null 2>&1; then
    echo "[rumors-push] $path -> $BRANCH ok"
    date +%s > "$state_file" 2>/dev/null
  else
    echo "[rumors-push] WARN: PUT $path fehlgeschlagen (Auth/Netz?) — skip"
  fi
}

push_file "web/public/data/rumors.json"
push_file "web/public/data/injuries.json"
push_file "web/public/data/squad.json"
push_file "web/public/data/squad_2026.json"
exit 0
