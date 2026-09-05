#!/bin/bash
# BVB-Aladin News Refresh — läuft alle 30 Minuten via LaunchAgent
set -e

REPO="/Users/jenssteffen/Claude/Claude neuer Account/bvb-aladin"
cd "$REPO"

echo "=== $(date -u +%Y-%m-%dT%H:%MZ) refresh start ==="

# Log-Rotation: launchd hängt stdout/err unbegrenzt an (refresh.err war 18 MB).
# In-place kürzen — "cat > f" behält die Inode, der offene Append-FD von
# launchd schreibt danach am neuen Ende weiter. Die letzten ~1 MB bleiben.
for f in logs/refresh.out logs/refresh.err; do
  if [ -f "$f" ] && [ "$(stat -f %z "$f")" -gt 5242880 ]; then
    { tail -c 1048576 "$f" > "$f.tmp" && cat "$f.tmp" > "$f" && rm -f "$f.tmp"; } \
      || echo "log rotation skipped: $f"
  fi
done

# Sicherstellen dass pip-Deps vorhanden
/usr/bin/python3 -m pip install -q -r requirements.txt

# Daten holen + scoren
/usr/bin/python3 fetcher.py
/usr/bin/python3 scorer.py

# Transfer-Gerüchte (Transfermarkt) — failsafe, darf den Lauf nie scheitern lassen
/usr/bin/python3 rumors_fetcher.py || echo "rumors skipped"

# Verletzungen & Sperren (Transfermarkt) — failsafe wie rumors
/usr/bin/python3 injuries_fetcher.py || echo "injuries skipped"

# X-Insider (Zweitaccount, Budget geteilt mit krypto-aladin) — failsafe;
# drosselt sich selbst (min. 7 h Abstand, Skip in Krypto-Slot-Stunden)
/usr/bin/python3 x_local_fetcher.py || echo "x_local skipped"

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

# X-Items (nur der Mac hat die X-Session) → Contents-API; der Push triggert
# den Action-Refresh, der sie in news.json einmischt:
./push_x_items.sh || echo "x push skipped"

echo "=== done ==="
