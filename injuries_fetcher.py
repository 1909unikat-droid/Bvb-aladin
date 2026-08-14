#!/usr/bin/env python3
"""BVB-Aladin Injuries Fetcher — Transfermarkt Sperren & Verletzungen -> injuries.json.

Scrapt https://www.transfermarkt.de/borussia-dortmund/sperrenundverletzungen/verein/16
und schreibt data/injuries.json in dem Schema, das die Fanpage bereits liest
(bvb-fanpage/lib/injuries.ts):

    {
      "updated_at": "YYYY-MM-DD",
      "players": [
        {"name": ..., "status": "fit"|"doubt"|"out",
         "reason": ..., "since": "YYYY-MM-DD", "expectedReturn": "..."}
      ]
    }

Status-Mapping: TM listet ausschließlich Spieler, die NICHT einsatzbereit sind —
"fit" kommt aus dieser Quelle also nie vor (der Wert bleibt für handgepflegte
Einträge im Schema). Default ist "out"; nur wenn der Grund nach angeschlagen /
Aufbautraining / Infekt klingt, wird daraus "doubt".

FAILSAFE (wie rumors_fetcher.py): HTTP != 200, Netzwerk-/Parse-Fehler oder eine
Seite ohne die erwartete Box -> data/injuries.json bleibt unangetastet, Warnung
nach stderr, Exit 0. AUSNAHME: Box vorhanden, aber keine Spieler-Zeile — das ist
keine Störung, sondern die Information "gesunde Truppe" und wird als
players: [] mit frischem updated_at geschrieben.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).parent
INJURIES_FILE = ROOT / "data" / "injuries.json"

TM_URL = "https://www.transfermarkt.de/borussia-dortmund/sperrenundverletzungen/verein/16"

# Realistischer Browser-User-Agent — TM antwortet einem echten Chrome-UA mit 200.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
}
TIMEOUT = 15

BOX_HEADLINE = "sperren und verletzungen"
# Gründe, bei denen der Einsatz wackelt statt feststeht.
DOUBT_HINTS = (
    "angeschlagen", "fraglich", "aufbautraining", "individualtraining",
    "erkältung", "erkaeltung", "grippe", "infekt", "unwohlsein", "beschwerden",
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def de_date_to_iso(text: str) -> str | None:
    """'01.03.2026' -> '2026-03-01'. None bei leerem/unbekanntem Format."""
    t = (text or "").strip()
    if not t:
        return None
    try:
        return datetime.strptime(t, "%d.%m.%Y").date().isoformat()
    except ValueError:
        return None


def map_status(reason: str, section: str) -> str:
    """TM-Grund + Abschnitts-Überschrift -> Schema-Status."""
    blob = f"{reason} {section}".lower()
    if any(h in blob for h in DOUBT_HINTS):
        return "doubt"
    return "out"


def fetch_tm_html() -> str | None:
    """Sperren-/Verletzungsseite laden. None bei HTTP != 200 oder Netzwerkfehler."""
    try:
        r = requests.get(TM_URL, headers=HEADERS, timeout=TIMEOUT)
    except Exception as exc:
        print(f"  [WARN] TM request failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return None
    if r.status_code != 200:
        print(f"  [WARN] TM returned HTTP {r.status_code} — leaving injuries.json untouched",
              file=sys.stderr)
        return None
    return r.text


def find_box(soup: BeautifulSoup):
    """Die Box 'Sperren und Verletzungen'. None = Seitenstruktur unerwartet."""
    for box in soup.select("div.box"):
        h2 = box.select_one("h2")
        if h2 and BOX_HEADLINE in h2.get_text(" ", strip=True).lower():
            return box
    return None


def parse_players(box) -> list[dict]:
    """Spieler-Zeilen der Box parsen. Wirft nicht — überspringt kaputte Zeilen.

    Die Tabelle mischt Abschnitts-Überschriften (einzelne Zelle, z.B.
    'Verletzungen' / 'Gesperrte Spieler') mit Datenzeilen
    (Spieler | Alter | Grund | seit | bis voraussichtlich | verpasste Spiele).
    """
    players: list[dict] = []
    for table in box.select("div.responsive-table table"):
        heads = [th.get_text(strip=True).lower() for th in table.select("thead th")]
        if "spieler" not in heads:
            continue
        section = ""
        for row in table.select("tbody > tr"):
            tds = row.find_all("td", recursive=False)
            if len(tds) == 1:
                section = tds[0].get_text(" ", strip=True)
                continue
            if len(tds) < 5:
                continue
            link = tds[0].select_one("a")
            if link is None:
                continue
            name = (link.get("title") or link.get_text(strip=True) or "").strip()
            if not name:
                continue
            reason = tds[2].get_text(" ", strip=True)
            entry = {
                "name": name,
                "status": map_status(reason, section),
                "reason": reason or "unbekannt",
            }
            since = de_date_to_iso(tds[3].get_text(" ", strip=True))
            if since:
                entry["since"] = since
            expected = tds[4].get_text(" ", strip=True)
            if expected and expected != "-":
                entry["expectedReturn"] = expected
            players.append(entry)
    return players


def main() -> int:
    html = fetch_tm_html()
    if html is None:
        return 0

    try:
        soup = BeautifulSoup(html, "html.parser")
        box = find_box(soup)
        if box is None:
            print("  [WARN] TM box 'Sperren und Verletzungen' not found — "
                  "leaving injuries.json untouched", file=sys.stderr)
            return 0
        players = parse_players(box)
    except Exception as exc:
        print(f"  [WARN] TM parse error: {type(exc).__name__}: {exc} — "
              f"leaving injuries.json untouched", file=sys.stderr)
        return 0

    payload = {
        "updated_at": now_utc().date().isoformat(),
        "players": players,
    }
    INJURIES_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    n_out = sum(1 for p in players if p["status"] == "out")
    n_doubt = sum(1 for p in players if p["status"] == "doubt")
    print(f"injuries: {len(players)} players (out {n_out} / doubt {n_doubt}) -> {INJURIES_FILE}",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
