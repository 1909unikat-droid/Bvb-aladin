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

# Commit + Push (nur wenn Änderungen vorhanden)
/usr/bin/git config user.name  "bvb-aladin-bot"
/usr/bin/git config user.email "bvb-aladin-bot@users.noreply.github.com"
/usr/bin/git add data/news.json data/raw_items.json web/public/data/news.json data/rumors.json web/public/data/rumors.json
if /usr/bin/git diff --cached --quiet; then
    echo "no changes — skip commit"
else
    /usr/bin/git commit -m "chore: refresh news $(date -u +%Y-%m-%dT%H:%MZ)"
    /usr/bin/git pull --rebase --autostash --strategy-option=theirs
    /usr/bin/git push
    echo "pushed"
fi

echo "=== done ==="
