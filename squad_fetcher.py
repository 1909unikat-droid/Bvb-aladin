#!/usr/bin/env python3
"""BVB Kader-Fetcher — scrapt Transfermarkt-Kaderseiten → data/squad.json.
Wird täglich aufgerufen (nicht bei jedem News-Refresh).
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).parent
SQUAD_FILE = ROOT / "data" / "squad.json"
SQUAD_2026_FILE = ROOT / "data" / "squad_2026.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.transfermarkt.de/",
    "DNT": "1",
}

TEAMS = [
    {"id": "profis",  "label": "Profis",  "league": "Bundesliga",       "tm_id": 16,    "tm_slug": "borussia-dortmund"},
    {"id": "u23",     "label": "U23",     "league": "3. Liga",           "tm_id": 3811,  "tm_slug": "bvb-09-dortmund-ii"},
    {"id": "u19",     "label": "U19",     "league": "U19-Bundesliga West","tm_id": 11558, "tm_slug": "borussia-dortmund-u19"},
]

POSITION_GROUP_MAP: dict[str, str] = {
    "bg_Torwart":    "Tor",
    "bg_Abwehr":     "Abwehr",
    "bg_Mittelfeld": "Mittelfeld",
    "bg_Sturm":      "Angriff",
}

POSITION_SHORT: dict[str, str] = {
    "Torwart":                  "TW",
    "Innenverteidiger":         "IV",
    "Linker Verteidiger":       "LV",
    "Rechter Verteidiger":      "RV",
    "Defensives Mittelfeld":    "DM",
    "Zentrales Mittelfeld":     "ZM",
    "Offensives Mittelfeld":    "OM",
    "Linkes Mittelfeld":        "LM",
    "Rechtes Mittelfeld":       "RM",
    "Linksaußen":               "LA",
    "Rechtsaußen":              "RA",
    "Hängende Spitze":          "HS",
    "Mittelstürmer":            "ST",
    "Angreifer":                "ST",
}

NATIONALITY_FLAG: dict[str, str] = {
    "Deutschland":           "🇩🇪",
    "Schweiz":               "🇨🇭",
    "Niederlande":           "🇳🇱",
    "Frankreich":            "🇫🇷",
    "England":               "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    "Schottland":            "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    "Wales":                 "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    "Österreich":            "🇦🇹",
    "Belgien":               "🇧🇪",
    "Spanien":               "🇪🇸",
    "Portugal":              "🇵🇹",
    "Italien":               "🇮🇹",
    "Norwegen":              "🇳🇴",
    "Schweden":              "🇸🇪",
    "Dänemark":              "🇩🇰",
    "Polen":                 "🇵🇱",
    "Tschechien":            "🇨🇿",
    "Slowakei":              "🇸🇰",
    "Slowenien":             "🇸🇮",
    "Kroatien":              "🇭🇷",
    "Serbien":               "🇷🇸",
    "Albanien":              "🇦🇱",
    "Kosovo":                "🇽🇰",
    "Bosnien-Herzegowina":   "🇧🇦",
    "Nordmazedonien":        "🇲🇰",
    "Ukraine":               "🇺🇦",
    "Rumänien":              "🇷🇴",
    "Ungarn":                "🇭🇺",
    "Bulgarien":             "🇧🇬",
    "Griechenland":          "🇬🇷",
    "Türkei":                "🇹🇷",
    "Russland":              "🇷🇺",
    "Irland":                "🇮🇪",
    "Israel":                "🇮🇱",
    "Algerien":              "🇩🇿",
    "Marokko":               "🇲🇦",
    "Nigeria":               "🇳🇬",
    "Ghana":                 "🇬🇭",
    "Senegal":               "🇸🇳",
    "Kamerun":               "🇨🇲",
    "Guinea":                "🇬🇳",
    "Elfenbeinküste":        "🇨🇮",
    "Tunesien":              "🇹🇳",
    "Ägypten":               "🇪🇬",
    "Brasilien":             "🇧🇷",
    "Argentinien":           "🇦🇷",
    "Kolumbien":             "🇨🇴",
    "Uruguay":               "🇺🇾",
    "Mexiko":                "🇲🇽",
    "USA":                   "🇺🇸",
    "Japan":                 "🇯🇵",
    "Korea, Süd":            "🇰🇷",
    "Australien":            "🇦🇺",
    "Surinam":               "🇸🇷",
    "Ecuador":               "🇪🇨",
    "Venezuela":             "🇻🇪",
    "Chile":                 "🇨🇱",
    "Peru":                  "🇵🇪",
}


def parse_market_value(raw: str) -> Optional[str]:
    """'40,00 Mio. €' → '40 Mio. €', '800 Tsd. €' → '800 Tsd. €'."""
    raw = raw.strip()
    if not raw or raw == "-":
        return None
    # Remove trailing whitespace/newlines
    raw = re.sub(r"\s+", " ", raw)
    # Normalise: "40,00 Mio. €" → "40 Mio. €"
    m = re.match(r"([\d]+),(\d+)\s*(Mio|Tsd)\.\s*€", raw)
    if m:
        mio_int = m.group(1)
        decimals = m.group(2).rstrip("0")
        unit = m.group(3)
        value = f"{mio_int},{decimals} {unit}. €" if decimals else f"{mio_int} {unit}. €"
        return value
    return raw


def parse_squad_value(soup: BeautifulSoup) -> Optional[str]:
    """Extract total squad value from TM page."""
    el = soup.select_one(".data-header__market-value-wrapper")
    if el:
        text = el.get_text(" ", strip=True)
        m = re.search(r"[\d,]+\s*(Mrd|Mio|Tsd)\.\s*€", text)
        if m:
            return m.group(0)
    return None


def fetch_squad(team: dict, session: requests.Session, seasons: tuple[str, ...] = ("2025", "2024")) -> list[dict]:
    """Scrape TM squad page for given team. Returns list of player dicts."""
    for season in seasons:
        url = (
            f"https://www.transfermarkt.de/{team['tm_slug']}"
            f"/kader/verein/{team['tm_id']}/saison_id/{season}"
        )
        players = _fetch_squad_url(url, team, session)
        if players:
            return players
    return []


def _fetch_squad_url(url: str, team: dict, session: requests.Session) -> list[dict]:
    """Internal: fetch + parse one URL."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as exc:
        print(f"  [FAIL] {team['id']} — {exc}", file=sys.stderr)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", class_="items")
    if not table:
        print(f"  [FAIL] {team['id']} — no items table found", file=sys.stderr)
        return []

    players: list[dict] = []
    player_id = 1

    for row in table.select("tbody tr"):
        # Get position group from rueckennummer td
        num_td = row.select_one("td.rueckennummer")
        if not num_td:
            continue

        # Jersey number
        rn_div = num_td.find("div")
        number_text = rn_div.get_text(strip=True) if rn_div else ""
        try:
            number = int(number_text)
        except ValueError:
            number = 0

        # Position group from CSS class bg_*
        pos_group_raw = "other"
        for cls in num_td.get("class", []):
            if cls.startswith("bg_"):
                pos_group_raw = cls
                break
        position_group = POSITION_GROUP_MAP.get(pos_group_raw, "Angriff")

        # Player name from inline-table hauptlink
        inline = row.select_one("table.inline-table")
        if not inline:
            continue
        name_a = inline.select_one("td.hauptlink a")
        if not name_a:
            continue
        name = name_a.get_text(strip=True)

        # TM player ID from href
        href = name_a.get("href", "")
        tm_player_id = re.search(r"/spieler/(\d+)", href)
        tm_id_val = int(tm_player_id.group(1)) if tm_player_id else 0

        # Detailed position from second row of inline-table
        position_tds = inline.select("tr td:not(.hauptlink)")
        position_detail = ""
        for td in position_tds:
            text = td.get_text(strip=True)
            if text and text not in name:
                position_detail = text
                break
        position_short = POSITION_SHORT.get(position_detail, position_detail[:3].upper() if position_detail else "?")

        # Age, nationality, contract, market value — remaining standalone tds
        outer_tds = [td for td in row.find_all("td", recursive=False)]
        # outer_tds: [rueckennummer(0), posrela(1), age(2), nat(3), contract(4), market_value(5)]

        age = 0
        nationality = "?"
        flag = "🏳️"
        contract = ""
        market_value = None

        if len(outer_tds) >= 3:
            age_text = outer_tds[2].get_text(strip=True)
            try:
                age = int(age_text)
            except ValueError:
                pass

        if len(outer_tds) >= 4:
            flag_img = outer_tds[3].find("img")
            if flag_img:
                nat_name = flag_img.get("title", flag_img.get("alt", "?"))
                nationality = nat_name
                flag = NATIONALITY_FLAG.get(nat_name, "🏳️")

        if len(outer_tds) >= 5:
            contract = outer_tds[4].get_text(strip=True)
            # Extract year from "30.06.2028"
            year_m = re.search(r"\d{4}", contract)
            contract = year_m.group(0) if year_m else contract

        if len(outer_tds) >= 6:
            mv_td = outer_tds[5]
            mv_text = mv_td.get_text(strip=True)
            market_value = parse_market_value(mv_text)

        players.append({
            "id": player_id,
            "tm_id": tm_id_val,
            "name": name,
            "number": number,
            "positionGroup": position_group,
            "positionShort": position_short,
            "positionDetail": position_detail,
            "nationality": nationality,
            "flag": flag,
            "age": age,
            "contract": contract,
            "marketValue": market_value,
        })
        player_id += 1

    print(f"  [ok] {team['id']:8s} → {len(players)} Spieler", file=sys.stderr)
    return players


def squad_value_sum(players: list[dict]) -> str:
    """Sum up market values for a squad."""
    total_mio = 0.0
    for p in players:
        mv = p.get("marketValue", "")
        if not mv:
            continue
        m = re.match(r"([\d]+)(?:,(\d+))?\s*(Mio|Tsd)\.\s*€", str(mv))
        if m:
            val = float(m.group(1)) + (float("0." + m.group(2)) if m.group(2) else 0)
            if m.group(3) == "Tsd":
                val /= 1000
            total_mio += val
    if total_mio == 0:
        return ""
    return f"{total_mio:,.0f} Mio. €".replace(",", ".")


def _build_teams(teams_scraped: list[tuple[dict, list[dict]]], fallback_file: Path) -> list[dict]:
    """Convert (team_def, players) pairs to output dicts, falling back to cached data if empty."""
    teams_out = []
    for team, players in teams_scraped:
        if not players:
            if fallback_file.exists():
                try:
                    existing = json.loads(fallback_file.read_text("utf-8"))
                    prev = next(
                        (t for t in existing.get("teams", []) if t["id"] == team["id"]),
                        None,
                    )
                    if prev:
                        teams_out.append(prev)
                        print(f"  [fallback] {team['id']} — using cached data from {fallback_file.name}", file=sys.stderr)
                        continue
                except Exception:
                    pass
        teams_out.append({
            "id": team["id"],
            "label": team["label"],
            "league": team["league"],
            "squadValue": squad_value_sum(players),
            "players": players,
        })
    if not any(t["id"] == "amateur" for t in teams_out):
        teams_out.append({
            "id": "amateur",
            "label": "Amateur",
            "league": "NRW-Liga",
            "squadValue": "",
            "players": [],
        })
    return teams_out


def main() -> int:
    print("== Squad Fetcher ==", file=sys.stderr)
    session = requests.Session()
    try:
        session.get("https://www.transfermarkt.de/", headers=HEADERS, timeout=10)
    except Exception:
        pass
    time.sleep(1)

    # --- Saison 2025 (squad.json) ---
    print("[2025/26]", file=sys.stderr)
    scraped_2025: list[tuple[dict, list[dict]]] = []
    for team in TEAMS:
        players = fetch_squad(team, session, seasons=("2025", "2024"))
        scraped_2025.append((team, players))
        time.sleep(1.5)

    teams_2025 = _build_teams(scraped_2025, SQUAD_FILE)
    payload_2025 = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "season": "2025",
        "teams": teams_2025,
    }
    SQUAD_FILE.write_text(json.dumps(payload_2025, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"squad.json written: {sum(len(t['players']) for t in teams_2025)} players total",
        file=sys.stderr,
    )

    # --- Saison 2026 (squad_2026.json) ---
    print("[2026/27]", file=sys.stderr)
    scraped_2026: list[tuple[dict, list[dict]]] = []
    has_real_2026_data = False
    for team in TEAMS:
        players = fetch_squad(team, session, seasons=("2026",))
        if players:
            has_real_2026_data = True
        scraped_2026.append((team, players))
        time.sleep(1.5)

    if has_real_2026_data:
        # TM has published 2026/27 data — write real data
        teams_2026 = _build_teams(scraped_2026, SQUAD_2026_FILE)
        pending = False
    else:
        # TM hasn't published yet — copy 2025 data as placeholder
        print("  [pending] saison_id/2026 empty on TM — using 2025 data as placeholder", file=sys.stderr)
        teams_2026 = [dict(t) for t in teams_2025]  # shallow copy is fine for JSON
        pending = True

    payload_2026 = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "season": "2026",
        "pending": pending,
        "teams": teams_2026,
    }
    SQUAD_2026_FILE.write_text(json.dumps(payload_2026, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"squad_2026.json written: {sum(len(t['players']) for t in teams_2026)} players, pending={pending}",
        file=sys.stderr,
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
