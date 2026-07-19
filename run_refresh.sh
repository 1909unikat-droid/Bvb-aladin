#!/bin/bash
# BVB-Aladin News Refresh — läuft alle 30 Minuten via LaunchAgent
set -e

REPO="/Users/jenssteffen/Claude/Claude neuer Account/bvb-aladin"
cd "$REPO"

echo "=== $(date -u +%Y-%m-%dT%H:%MZ) refresh start ==="

# Sicherstellen dass pip-Deps vorhanden
/usr/bin/python3 -m pip install -q -r requirements.txt

# Daten holen + scoren
/usr/bin/python3 fetcher.py
/usr/bin/python3 scorer.py

# Transfer-Gerüchte (Transfermarkt) — failsafe, darf den Lauf nie scheitern lassen
/usr/bin/python3 rumors_fetcher.py || echo "rumors skipped"

# news.json + rumors.json in web/public/data spiegeln
mkdir -p web/public/data
cp data/news.json web/public/data/news.json
if [ -f data/rumors.json ]; then cp data/rumors.json web/public/data/rumors.json; fi

# Veröffentlichung:
# - news.json publiziert AUSSCHLIESSLICH die GitHub Action (alle 30 min) —
#   lokal wird NICHT mehr committet/gepusht (die alte Parallel-Historie
#   liegt archiviert auf dem lokalen main; nie von hier pushen!).
# - rumors.json kann NUR der Mac liefern (Transfermarkt blockt die
#   Action-IPs mit HTTP 202) → gezielter Upload via Contents-API:
./push_rumors.sh || echo "rumors push skipped"

echo "=== done ==="
