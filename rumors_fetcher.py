#!/usr/bin/env python3
"""BVB-Aladin Rumors Fetcher — Transfermarkt-Gerüchteküche + news.json Cross-Ref -> rumors.json.

Scrapt die Transfermarkt-Gerüchteküche von Borussia Dortmund
(https://www.transfermarkt.de/borussia-dortmund/geruechte/verein/16) und reichert
jedes Gerücht mit passenden Transfer-Items aus data/news.json an.

Richtung:
    "in"  (Zugang) = Spieler eines anderen Vereins wird zum BVB gehandelt
    "out" (Abgang) = BVB-Spieler wird zu einem anderen Verein gehandelt
    Erkennung sprach-unabhängig über die Spalte "Verein" (aktueller Klub des
    Spielers). Ist das Borussia Dortmund -> Abgang, sonst Zugang. (Die Gerücht-
    Überschriften stehen auf TM in vielen Sprachen, daher kein Text-Parsing.)

Wahrscheinlichkeits-Score (0..100), transparent:
    base    = TM-Wechselwahrscheinlichkeit in % (Spalte "Wertung"), sonst DEFAULT_BASE (30)
    + Tier-Bonus  : Tier-1-Insider-Nennung (Romano/Plettenberg/Berger/Ornstein/Falk ...)
                    in news.json -> +TIER1_BONUS, je weitere Tier-1-Quelle +TIER1_EXTRA
                    (gedeckelt bei TIER1_MAX); sonst falls Tier-2-Medium -> +TIER2_BONUS
    + Frische     : letzte Nennung in news.json jünger als FRESH_H (48h) -> +FRESH_BONUS
    - Alt-Abzug   : letzte Nennung älter als STALE_DAYS (14 Tage) ODER gar keine
                    News-Nennung -> -STALE_PENALTY
    -> geklemmt auf [SCORE_MIN, SCORE_MAX] = [5, 95]

FAILSAFE: Bei HTTP != 200, Netzwerk-/Parse-Fehler oder 0 gefundenen Gerüchten bleibt
data/rumors.json unverändert, es geht eine Warnung nach stderr und der Prozess endet
mit Exit 0. Der Refresh-Lauf (run_refresh.sh / GitHub Action) darf nie an diesem
Zusatz-Modul scheitern — GitHub-Action-IPs könnten von TM geblockt werden.

Output data/rumors.json:
    {
      "generated_at": ISO,
      "source": "transfermarkt.de + news-feed",
      "count": N,
      "rumors": [
        {player, age, position, marketValue, currentClub, direction,
         probability, tmProbability, tmUrl, sources: [...], lastMention}
      ]   # sortiert nach probability absteigend
    }
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).parent
NEWS_FILE = ROOT / "data" / "news.json"
RUMORS_FILE = ROOT / "data" / "rumors.json"

TM_URL = "https://www.transfermarkt.de/borussia-dortmund/geruechte/verein/16"
TM_BASE = "https://www.transfermarkt.de"

# Realistischer Browser-User-Agent — TM antwortet mit einem echten Chrome-UA 200.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
}
TIMEOUT = 15

# --- Scoring-Konstanten (siehe Modul-Docstring) ---
DEFAULT_BASE = 30
TIER1_BONUS = 12
TIER1_EXTRA = 3
TIER1_MAX = 21
TIER2_BONUS = 6
FRESH_BONUS = 8
STALE_PENALTY = 10
FRESH_H = 48
STALE_DAYS = 14
SCORE_MIN = 5
SCORE_MAX = 95


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def strip_accents(s: str) -> str:
    """Diakritika entfernen für robustes Namens-Matching (Casadó -> casado)."""
    nfkd = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def surname_of(name: str) -> str:
    """Nachname = letztes Namens-Token; zu kurze Token mit dem vorigen kombinieren."""
    toks = [t for t in (name or "").split() if t]
    if not toks:
        return ""
    surname = toks[-1]
    if len(surname) < 4 and len(toks) >= 2:
        surname = f"{toks[-2]} {toks[-1]}"
    return surname


def is_dortmund(club: str) -> bool:
    c = strip_accents(club or "").lower()
    return "dortmund" in c


def parse_probability(text: str) -> int | None:
    m = re.search(r"(\d{1,3})\s*%", text or "")
    if not m:
        return None
    val = int(m.group(1))
    return val if 0 <= val <= 100 else None


def fetch_tm_html() -> str | None:
    """TM-Gerüchteküche laden. None bei HTTP != 200 oder Netzwerkfehler."""
    try:
        r = requests.get(TM_URL, headers=HEADERS, timeout=TIMEOUT)
    except Exception as exc:
        print(f"  [WARN] TM request failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return None
    if r.status_code != 200:
        print(f"  [WARN] TM returned HTTP {r.status_code} — leaving rumors.json untouched", file=sys.stderr)
        return None
    return r.text


def parse_rumors(html: str) -> list[dict]:
    """Gerüchte-Tabelle parsen. Wirft nicht — überspringt kaputte Zeilen."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("div.responsive-table table")
    if table is None:
        return []
    rows = table.select("tbody > tr")
    rumors: list[dict] = []
    for r in rows:
        tds = r.find_all("td", recursive=False)
        if len(tds) < 8:
            continue
        name_a = tds[1].select_one("td.hauptlink a")
        if name_a is None:
            continue
        player = (name_a.get("title") or name_a.get_text(strip=True)).strip()
        if not player:
            continue

        # Detail-Position steht in der zweiten Zeile der inneren inline-table.
        pos_rows = tds[1].select("tr")
        position = pos_rows[-1].get_text(strip=True) if pos_rows else ""

        age_txt = tds[3].get_text(strip=True)
        age = int(age_txt) if age_txt.isdigit() else None

        club_a = tds[4].select_one("a")
        current_club = ""
        if club_a is not None:
            img = club_a.select_one("img")
            current_club = (img.get("title") if img else club_a.get("title", "")) or ""
        current_club = current_club.strip()

        mv = tds[5].get_text(strip=True)
        market_value = mv if mv else None

        src_a = tds[6].select_one("a")
        tm_url = ""
        if src_a is not None:
            tm_url = urljoin(TM_BASE, src_a.get("href", ""))

        tm_probability = parse_probability(tds[7].get_text(" ", strip=True))

        direction = "out" if is_dortmund(current_club) else "in"

        rumors.append({
            "player": player,
            "age": age,
            "position": position,
            "marketValue": market_value,
            "currentClub": current_club,
            "direction": direction,
            "tmProbability": tm_probability,
            "tmUrl": tm_url,
        })
    return rumors


def load_news_transfers() -> list[dict]:
    """Transfer-Items aus news.json. Leer, wenn Datei fehlt/kaputt (kein Fehler)."""
    if not NEWS_FILE.exists():
        return []
    try:
        data = json.loads(NEWS_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"  [WARN] news.json unreadable: {type(exc).__name__}: {exc}", file=sys.stderr)
        return []
    items = data.get("items", [])
    return [it for it in items if it.get("category") == "transfers"]


def cross_reference(rumor: dict, transfers: list[dict], now: datetime) -> tuple[list[dict], str | None, int | None]:
    """Passende news.json-Transfer-Items finden.

    Returns (sources, lastMention, best_tier).
    - sources: [{name, tier, url, published}] pro gematchtem News-Cluster
    - lastMention: jüngstes published unter den Matches (ISO) oder None
    - best_tier: niedrigster (bester) Tier über Match-Items UND deren Bestätigungen
    """
    surname = strip_accents(surname_of(rumor["player"])).lower()
    if len(surname) < 4:
        return [], None, None

    sources: list[dict] = []
    tiers: list[int] = []
    latest: datetime | None = None
    for it in transfers:
        title_norm = strip_accents(it.get("title", "")).lower()
        if surname not in title_norm:
            continue
        sources.append({
            "name": it.get("source", ""),
            "tier": it.get("tier"),
            "url": it.get("url", ""),
            "published": it.get("published"),
        })
        # Tier-Erkennung inkl. Bestätigungen (dort steckt oft die Insider-Quelle).
        if isinstance(it.get("tier"), int):
            tiers.append(it["tier"])
        for c in it.get("confirmations", []):
            if isinstance(c.get("tier"), int):
                tiers.append(c["tier"])
        pub = parse_iso(it.get("published"))
        if pub and (latest is None or pub > latest):
            latest = pub

    last_mention = latest.isoformat() if latest else None
    best_tier = min(tiers) if tiers else None
    return sources, last_mention, best_tier


def score_rumor(rumor: dict, sources: list[dict], last_mention: str | None,
                best_tier: int | None, now: datetime) -> int:
    """Wahrscheinlichkeits-Score 0..100 — Logik siehe Modul-Docstring."""
    base = rumor["tmProbability"] if rumor["tmProbability"] is not None else DEFAULT_BASE
    score = float(base)

    # Tier-Bonus
    if best_tier == 1:
        tier1_sources = sum(1 for s in sources if s.get("tier") == 1)
        bonus = TIER1_BONUS + max(tier1_sources - 1, 0) * TIER1_EXTRA
        score += min(bonus, TIER1_MAX)
    elif best_tier == 2:
        score += TIER2_BONUS

    # Frische / Alt-Abzug
    pub = parse_iso(last_mention)
    if pub is None:
        score -= STALE_PENALTY
    else:
        age_h = (now - pub).total_seconds() / 3600.0
        if age_h < FRESH_H:
            score += FRESH_BONUS
        elif age_h > STALE_DAYS * 24:
            score -= STALE_PENALTY

    return int(round(max(SCORE_MIN, min(SCORE_MAX, score))))


def build_payload(rumors: list[dict], now: datetime) -> dict:
    transfers = load_news_transfers()
    enriched: list[dict] = []
    for r in rumors:
        sources, last_mention, best_tier = cross_reference(r, transfers, now)
        probability = score_rumor(r, sources, last_mention, best_tier, now)
        enriched.append({
            "player": r["player"],
            "age": r["age"],
            "position": r["position"],
            "marketValue": r["marketValue"],
            "currentClub": r["currentClub"],
            "direction": r["direction"],
            "probability": probability,
            "tmProbability": r["tmProbability"],
            "tmUrl": r["tmUrl"],
            "sources": sources,
            "lastMention": last_mention,
        })
    enriched.sort(key=lambda x: x["probability"], reverse=True)
    return {
        "generated_at": now.isoformat(),
        "source": "transfermarkt.de + news-feed",
        "count": len(enriched),
        "rumors": enriched,
    }


def main() -> int:
    now = now_utc()

    html = fetch_tm_html()
    if html is None:
        # Failsafe: nichts überschreiben, Lauf nicht scheitern lassen.
        return 0

    try:
        rumors = parse_rumors(html)
    except Exception as exc:
        print(f"  [WARN] TM parse error: {type(exc).__name__}: {exc} — leaving rumors.json untouched",
              file=sys.stderr)
        return 0

    if not rumors:
        print("  [WARN] TM parse yielded 0 rumors — leaving rumors.json untouched", file=sys.stderr)
        return 0

    payload = build_payload(rumors, now)
    RUMORS_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    n_in = sum(1 for r in payload["rumors"] if r["direction"] == "in")
    n_out = sum(1 for r in payload["rumors"] if r["direction"] == "out")
    with_news = sum(1 for r in payload["rumors"] if r["sources"])
    print(
        f"rumors: {len(rumors)} parsed (in {n_in} / out {n_out}), "
        f"{with_news} cross-referenced with news.json -> {RUMORS_FILE}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
