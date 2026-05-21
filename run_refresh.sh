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

# news.json in web/public/data spiegeln
mkdir -p web/public/data
cp data/news.json web/public/data/news.json

# Commit + Push (nur wenn Änderungen vorhanden)
/usr/bin/git config user.name  "bvb-aladin-bot"
/usr/bin/git config user.email "bvb-aladin-bot@users.noreply.github.com"
/usr/bin/git add data/news.json data/raw_items.json web/public/data/news.json
if /usr/bin/git diff --cached --quiet; then
    echo "no changes — skip commit"
else
    /usr/bin/git commit -m "chore: refresh news $(date -u +%Y-%m-%dT%H:%MZ)"
    /usr/bin/git pull --rebase --autostash --strategy-option=theirs
    /usr/bin/git push
    echo "pushed"
fi

echo "=== done ==="
