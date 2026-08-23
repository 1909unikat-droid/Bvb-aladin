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

# Kader (Transfermarkt) — HÖCHSTENS 1x pro Tag. Dieser Lauf startet alle
# 30 min, der Kader-Scrape zieht aber ~90 s über viele TM-Requests. Steuergröße
# ist das Alter von data/squad_2026.json: squad_fetcher.py schreibt die Datei
# bei JEDEM Lauf, ihr mtime ist also der letzte Versuch — auch ein an TM
# gescheiterter Lauf wartet damit bis morgen und hämmert nicht gegen die Sperre.
# Publisher-Split wie bei rumors/injuries: TM blockt die Action-IPs, der Mac ist
# alleiniger Kader-Publisher (siehe .github/workflows/refresh-squad.yml).
SQUAD_MAX_AGE_H=20
squad_mtime=$(stat -f %m data/squad_2026.json 2>/dev/null || echo 0)
if [ $(( ($(date +%s) - ${squad_mtime:-0}) / 3600 )) -ge "$SQUAD_MAX_AGE_H" ]; then
  /usr/bin/python3 squad_fetcher.py || echo "squad skipped"
else
  echo "squad frisch (<${SQUAD_MAX_AGE_H}h) — skip"
fi

# Daten-Dateien in web/public/data spiegeln
mkdir -p web/public/data
cp data/news.json web/public/data/news.json
if [ -f data/rumors.json ];       then cp data/rumors.json       web/public/data/rumors.json;       fi
if [ -f data/injuries.json ];     then cp data/injuries.json     web/public/data/injuries.json;     fi
if [ -f data/vibe_history.json ]; then cp data/vibe_history.json web/public/data/vibe_history.json; fi
if [ -f data/squad.json ];        then cp data/squad.json        web/public/data/squad.json;        fi
if [ -f data/squad_2026.json ];   then cp data/squad_2026.json   web/public/data/squad_2026.json;   fi

# Veröffentlichung:
# - news.json publiziert AUSSCHLIESSLICH die GitHub Action (alle 30 min) —
#   lokal wird NICHT mehr committet/gepusht (die alte Parallel-Historie
#   liegt archiviert auf dem lokalen main; nie von hier pushen!).
# - rumors.json + injuries.json können NUR vom Mac kommen (Transfermarkt
#   blockt die Action-IPs mit HTTP 202) → gezielter Upload via Contents-API.
#   vibe_history.json liefert die Action zwar auch, der lokale Push hält sie
#   zwischen zwei Action-Läufen aktuell:
# - squad.json + squad_2026.json ebenfalls nur vom Mac (die Action sah wegen
#   der TM-Sperre nur ihren eigenen Fallback-Stand):
./push_rumors.sh || echo "rumors push skipped"

echo "=== done ==="
