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

# Verletzungen & Sperren (Transfermarkt) — failsafe wie rumors
/usr/bin/python3 injuries_fetcher.py || echo "injuries skipped"

# Vibe-Historie (Tages-Score aus news.json) — failsafe
/usr/bin/python3 vibe_history.py || echo "vibe history skipped"

# Daten-Dateien in web/public/data spiegeln
mkdir -p web/public/data
cp data/news.json web/public/data/news.json
if [ -f data/rumors.json ];       then cp data/rumors.json       web/public/data/rumors.json;       fi
if [ -f data/injuries.json ];     then cp data/injuries.json     web/public/data/injuries.json;     fi
if [ -f data/vibe_history.json ]; then cp data/vibe_history.json web/public/data/vibe_history.json; fi

# Veröffentlichung:
# - news.json publiziert AUSSCHLIESSLICH die GitHub Action (alle 30 min) —
#   lokal wird NICHT mehr committet/gepusht (die alte Parallel-Historie
#   liegt archiviert auf dem lokalen main; nie von hier pushen!).
# - rumors.json + injuries.json können NUR vom Mac kommen (Transfermarkt
#   blockt die Action-IPs mit HTTP 202) → gezielter Upload via Contents-API.
#   vibe_history.json liefert die Action zwar auch, der lokale Push hält sie
#   zwischen zwei Action-Läufen aktuell:
./push_rumors.sh || echo "rumors push skipped"

echo "=== done ==="
