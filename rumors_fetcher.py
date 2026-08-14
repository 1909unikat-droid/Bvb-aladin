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

Zwei Quell-Pfade:
    (1) Vereins-Gerüchteküche, paginiert (Seite 1..MAX_RUMOR_PAGES). Die Box
        heißt dort wörtlich "Gerüchte um Zugänge" — TM listet auf dieser Seite
        AUSSCHLIESSLICH Zugänge, eine Abgangs-Box existiert dort nicht
        (geprüft 2026-08-14: Seite 1 = 25 Zeilen, Seite 2 = 20 Zeilen, /plus/1
        nur mit Extra-Spalten, in keiner Variante eine Abgangs-Tabelle).
    (2) Deshalb für Abgänge das Gerüchtearchiv der Spieler-Profile
        (/spieler/geruechte/spieler/<tm_id>): dort steht pro BVB-Spieler, welche
        Vereine an ihm dran sind. Die tm_id kommt aus data/squad_2026.json — es
        wird also nichts geraten, kein Namens-Matching, keine Suche. Geprüft
        werden die OUT_MAX_PLAYERS wertvollsten Profis ab OUT_MIN_MARKET_VALUE_M
        Mio. Marktwert, mit OUT_PAUSE_S Pause zwischen den Requests.
        Das Archiv ist historisch (Chukwuemekas BVB-Wechsel von 2025 steht dort
        noch), deshalb zählen nur Einträge, deren letzter Quelleneintrag jünger
        als OUT_MAX_AGE_DAYS ist; "Borussia Dortmund" als interessierter Verein
        wird verworfen (das ist der Zugang von damals).

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
    Abgangs-Gerüchte tragen zusätzlich das optionale Feld "interestedClub"
    (der Verein, der laut TM an dem BVB-Spieler dran ist) — additiv, ältere
    Consumer ignorieren es.
"""
from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).parent
NEWS_FILE = ROOT / "data" / "news.json"
RUMORS_FILE = ROOT / "data" / "rumors.json"
SQUAD_FILE = ROOT / "data" / "squad_2026.json"

TM_URL = "https://www.transfermarkt.de/borussia-dortmund/geruechte/verein/16"
TM_PLAYER_RUMORS_URL = "https://www.transfermarkt.de/spieler/geruechte/spieler/{tm_id}"
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

# --- Quell-Pfad 1: Vereins-Gerüchteküche (Zugänge, paginiert) ---
MAX_RUMOR_PAGES = 3

# --- Quell-Pfad 2: Spieler-Gerüchtearchive (Abgänge) ---
OUT_MIN_MARKET_VALUE_M = 15.0   # Mio. € — darunter lohnt der Extra-Request nicht
OUT_MAX_PLAYERS = 8
OUT_PAUSE_S = 2.0               # Rate-Limit: 1 Request / 2s
OUT_MAX_AGE_DAYS = 60           # ältere Archiv-Einträge sind kein laufendes Gerücht
BVB_CLUB_NAME = "Borussia Dortmund"


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


def parse_de_date(text: str) -> datetime | None:
    """'18.07.2026' -> datetime (UTC). None bei leerem/unbekanntem Format."""
    t = (text or "").strip()
    if not t:
        return None
    try:
        return datetime.strptime(t, "%d.%m.%Y").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_market_value_m(text: str | None) -> float:
    """'40,00 Mio. €' -> 40.0, '800 Tsd. €' -> 0.8, sonst 0.0."""
    m = re.search(r"([\d.,]+)\s*(Mio|Tsd)", text or "")
    if not m:
        return 0.0
    try:
        value = float(m.group(1).replace(".", "").replace(",", "."))
    except ValueError:
        return 0.0
    return value if m.group(2) == "Mio" else value / 1000.0


def fetch_tm_html(url: str = TM_URL, warn: bool = True) -> str | None:
    """TM-Seite laden. None bei HTTP != 200 oder Netzwerkfehler."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    except Exception as exc:
        if warn:
            print(f"  [WARN] TM request failed ({url}): {type(exc).__name__}: {exc}", file=sys.stderr)
        return None
    if r.status_code != 200:
        if warn:
            print(f"  [WARN] TM returned HTTP {r.status_code} for {url}", file=sys.stderr)
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


def fetch_incoming_rumors() -> list[dict] | None:
    """Alle Seiten der Vereins-Gerüchteküche. None = Seite 1 nicht erreichbar."""
    html = fetch_tm_html(TM_URL)
    if html is None:
        return None

    try:
        rumors = parse_rumors(html)
    except Exception as exc:
        print(f"  [WARN] TM parse error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return None

    seen = {(r["player"], r["currentClub"]) for r in rumors}
    for page in range(2, MAX_RUMOR_PAGES + 1):
        time.sleep(OUT_PAUSE_S)
        page_html = fetch_tm_html(f"{TM_URL}/page/{page}", warn=False)
        if page_html is None:
            break
        try:
            more = parse_rumors(page_html)
        except Exception:
            break
        # Über die letzte Seite hinaus liefert TM wieder Seite 1 — Dubletten stoppen.
        fresh = [r for r in more if (r["player"], r["currentClub"]) not in seen]
        if not fresh:
            break
        seen.update((r["player"], r["currentClub"]) for r in fresh)
        rumors.extend(fresh)
    return rumors


def load_squad_candidates() -> list[dict]:
    """Wertvollste Profis aus squad_2026.json (mit tm_id) für die Abgangs-Prüfung."""
    if not SQUAD_FILE.exists():
        return []
    try:
        squad = json.loads(SQUAD_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"  [WARN] squad_2026.json unreadable: {type(exc).__name__}: {exc}", file=sys.stderr)
        return []

    players: list[dict] = []
    for team in squad.get("teams", []):
        if team.get("id") != "profis":
            continue
        for p in team.get("players", []):
            if not p.get("tm_id") or not p.get("name"):
                continue
            mv = parse_market_value_m(p.get("marketValue"))
            if mv < OUT_MIN_MARKET_VALUE_M:
                continue
            players.append({**p, "_mv": mv})
    players.sort(key=lambda p: p["_mv"], reverse=True)
    return players[:OUT_MAX_PLAYERS]


def parse_player_rumor_archive(html: str, now: datetime) -> tuple[str, datetime, int | None] | None:
    """Jüngstes laufendes Abgangs-Gerücht aus dem Gerüchtearchiv eines Profils.

    Spalten: Interessierter Verein | verein_id | Letzter Quelleneintrag |
             Letzte Antwort | Usereinschätzung
    Returns (interessierter Verein, Datum, TM-Wertung%) oder None.
    """
    soup = BeautifulSoup(html, "html.parser")
    box = None
    for candidate in soup.select("div.box"):
        h2 = candidate.select_one("h2")
        if h2 and "gerüchtearchiv" in h2.get_text(" ", strip=True).lower():
            box = candidate
            break
    if box is None:
        return None

    cutoff = now - timedelta(days=OUT_MAX_AGE_DAYS)
    best: tuple[str, datetime, int | None] | None = None
    for row in box.select("tbody > tr"):
        tds = row.find_all("td", recursive=False)
        if len(tds) < 3:
            continue
        club = tds[1].get_text(" ", strip=True)
        if not club or is_dortmund(club):
            continue  # der BVB selbst = das Zugangs-Gerücht von damals
        seen_at = parse_de_date(tds[2].get_text(" ", strip=True))
        if seen_at is None or seen_at < cutoff:
            continue
        prob = parse_probability(tds[4].get_text(" ", strip=True)) if len(tds) > 4 else None
        if best is None or seen_at > best[1]:
            best = (club, seen_at, prob)
    return best


def fetch_outgoing_rumors(now: datetime) -> list[dict]:
    """Abgangs-Gerüchte über die Spieler-Gerüchtearchive. Fehler -> Spieler skippen."""
    candidates = load_squad_candidates()
    if not candidates:
        print("  [WARN] no squad candidates for outgoing rumors — skipping", file=sys.stderr)
        return []

    out: list[dict] = []
    for i, p in enumerate(candidates):
        if i:
            time.sleep(OUT_PAUSE_S)
        url = TM_PLAYER_RUMORS_URL.format(tm_id=p["tm_id"])
        html = fetch_tm_html(url, warn=False)
        if html is None:
            continue
        try:
            hit = parse_player_rumor_archive(html, now)
        except Exception as exc:
            print(f"  [WARN] archive parse failed for {p['name']}: {type(exc).__name__}", file=sys.stderr)
            continue
        if hit is None:
            continue
        club, _seen_at, prob = hit
        out.append({
            "player": p["name"],
            "age": p.get("age"),
            "position": p.get("positionDetail") or p.get("positionShort") or "",
            "marketValue": p.get("marketValue"),
            "currentClub": BVB_CLUB_NAME,
            "interestedClub": club,
            "direction": "out",
            "tmProbability": prob,
            "tmUrl": url,
        })
    return out


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
        item = {
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
        }
        # Nur Abgänge tragen den interessierten Verein (additiv, optional).
        if r.get("interestedClub"):
            item["interestedClub"] = r["interestedClub"]
        enriched.append(item)
    enriched.sort(key=lambda x: x["probability"], reverse=True)
    return {
        "generated_at": now.isoformat(),
        "source": "transfermarkt.de + news-feed",
        "count": len(enriched),
        "rumors": enriched,
    }


def main() -> int:
    now = now_utc()

    rumors = fetch_incoming_rumors()
    if rumors is None:
        # Failsafe: nichts überschreiben, Lauf nicht scheitern lassen.
        print("  [WARN] TM unreachable/unparsable — leaving rumors.json untouched", file=sys.stderr)
        return 0

    if not rumors:
        print("  [WARN] TM parse yielded 0 rumors — leaving rumors.json untouched", file=sys.stderr)
        return 0

    # Abgänge sind ein Zusatz — schlägt der Pfad fehl, bleiben die Zugänge stehen.
    rumors.extend(fetch_outgoing_rumors(now))

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
