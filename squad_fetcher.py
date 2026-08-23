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
    {"id": "u23",     "label": "U23",     "league": "3. Liga",           "tm_id": 17,    "tm_slug": "borussia-dortmund-ii"},
    {"id": "u19",     "label": "U19",     "league": "U19-Bundesliga West","tm_id": 1464,  "tm_slug": "borussia-dortmund-u19"},
]

POSITION_GROUP_MAP: dict[str, str] = {
    "bg_Torwart":    "Tor",
    "bg_Abwehr":     "Abwehr",
    "bg_Mittelfeld": "Mittelfeld",
    "bg_Sturm":      "Angriff",
}

POSITION_DETAIL_TO_GROUP: dict[str, str] = {
    "Torwart":              "Tor",
    "Innenverteidiger":     "Abwehr",
    "Linker Verteidiger":   "Abwehr",
    "Rechter Verteidiger":  "Abwehr",
    "Defensives Mittelfeld":"Mittelfeld",
    "Zentrales Mittelfeld": "Mittelfeld",
    "Offensives Mittelfeld":"Mittelfeld",
    "Linkes Mittelfeld":    "Mittelfeld",
    "Rechtes Mittelfeld":   "Mittelfeld",
    "Linksaußen":           "Angriff",
    "Rechtsaußen":          "Angriff",
    "Hängende Spitze":      "Angriff",
    "Mittelstürmer":        "Angriff",
    "Angreifer":            "Angriff",
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
    "Vereinigte Staaten":    "🇺🇸",
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
    """'40,00 Mio. €' → '40 Mio. €', '800 Tsd. €' → '800 Tsd. €'. Non-values → None."""
    raw = raw.strip()
    if not raw or raw in ("-", "?", "k.A."):
        return None
    raw = re.sub(r"\s+", " ", raw)
    # Must contain € to be a market value
    if "€" not in raw:
        return None
    # Normalise: "40,00 Mio. €" → "40 Mio. €"
    m = re.match(r"([\d]+),(\d+)\s*(Mio|Tsd)\.\s*€", raw)
    if m:
        mio_int = m.group(1)
        decimals = m.group(2).rstrip("0")
        unit = m.group(3)
        return f"{mio_int},{decimals} {unit}. €" if decimals else f"{mio_int} {unit}. €"
    # Already clean format like "7 Mio. €" or "500 Tsd. €"
    if re.search(r"\d+\s*(Mio|Tsd)\.\s*€", raw):
        return raw
    return None


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


def fetch_transfers(season: str, session: requests.Session) -> tuple[list[dict], set[int]]:
    """Scrape TM transfers page for BVB. Returns (incoming_players, outgoing_tm_ids)."""
    url = f"https://www.transfermarkt.de/borussia-dortmund/transfers/verein/16/saison_id/{season}"
    try:
        resp = session.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as exc:
        print(f"  [FAIL] transfers {season} — {exc}", file=sys.stderr)
        return [], set()

    soup = BeautifulSoup(resp.text, "html.parser")
    tables = soup.find_all("table", class_="items")
    if not tables:
        print(f"  [INFO] transfers {season} — no items tables found", file=sys.stderr)
        return [], set()

    # Find Zugänge and Abgänge tables by scanning preceding headings
    zugaenge_table: Optional[object] = None
    abgaenge_table: Optional[object] = None
    for table in tables:
        heading_el = table.find_previous(["h2", "h3"])
        if not heading_el:
            continue
        heading_text = heading_el.get_text(strip=True)
        if "Zugang" in heading_text and zugaenge_table is None:
            zugaenge_table = table
        elif "Abgang" in heading_text and abgaenge_table is None:
            abgaenge_table = table

    # Fallback: first = arrivals, second = departures
    if zugaenge_table is None and tables:
        zugaenge_table = tables[0]
    if abgaenge_table is None and len(tables) > 1:
        abgaenge_table = tables[1]

    def _parse_transfer_row(row, id_base: int) -> Optional[dict]:
        inline = row.select_one("table.inline-table")
        name_a = inline.select_one("td.hauptlink a") if inline else row.select_one("td.hauptlink a")
        if not name_a:
            return None
        name = name_a.get_text(strip=True)
        if not name:
            return None

        href = name_a.get("href", "")
        tm_m = re.search(r"/spieler/(\d+)", href)
        tm_id_val = int(tm_m.group(1)) if tm_m else 0

        position_detail = ""
        if inline:
            for td in inline.select("tr td:not(.hauptlink)"):
                text = td.get_text(strip=True)
                if text and text not in name:
                    position_detail = text
                    break

        position_group = "Mittelfeld"
        for detail, grp in POSITION_DETAIL_TO_GROUP.items():
            if detail in position_detail:
                position_group = grp
                break
        position_short = POSITION_SHORT.get(position_detail, position_detail[:2].upper() if position_detail else "?")

        age = 0
        nationality = "?"
        flag = "🏳️"
        market_value = None
        for td in row.find_all("td", recursive=False):
            txt = td.get_text(strip=True)
            if not age:
                try:
                    v = int(txt)
                    if 15 <= v <= 45:
                        age = v
                except ValueError:
                    pass
            if nationality == "?":
                for img in td.find_all("img"):
                    src = img.get("src", img.get("data-src", ""))
                    # Flag images on TM have "flagge" in the URL
                    if "flagge" in src or "flags" in src:
                        nat = img.get("title", img.get("alt", ""))
                        if nat and nat != "?":
                            nationality = nat
                            flag = NATIONALITY_FLAG.get(nat, "🏳️")
                            break

        mv_td = row.select_one("td.rechts") or row.select_one("td.hauptlink.rechts")
        if mv_td:
            market_value = parse_market_value(mv_td.get_text(strip=True))

        return {
            "id": id_base,
            "tm_id": tm_id_val,
            "name": name,
            "number": 0,
            "positionGroup": position_group,
            "positionShort": position_short,
            "positionDetail": position_detail,
            "nationality": nationality,
            "flag": flag,
            "age": age,
            "contract": "",
            "marketValue": market_value,
        }

    incoming: list[dict] = []
    if zugaenge_table:
        for i, row in enumerate(zugaenge_table.select("tbody tr")):
            p = _parse_transfer_row(row, 8000 + i)
            if p:
                incoming.append(p)
    print(f"  [ok] transfers {season} Zugänge → {len(incoming)} Spieler", file=sys.stderr)

    outgoing_ids: set[int] = set()
    if abgaenge_table:
        for row in abgaenge_table.select("tbody tr"):
            name_a = row.select_one("td.hauptlink a") or (row.select_one("table.inline-table td.hauptlink a") if row.select_one("table.inline-table") else None)
            if name_a:
                href = name_a.get("href", "")
                tm_m = re.search(r"/spieler/(\d+)", href)
                if tm_m:
                    outgoing_ids.add(int(tm_m.group(1)))
    print(f"  [ok] transfers {season} Abgänge → {len(outgoing_ids)} Spieler", file=sys.stderr)

    return incoming, outgoing_ids


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

    # Fetch transfers (Zugänge + Abgänge) for 2026/27
    time.sleep(1.5)
    incoming_2026, outgoing_ids_2026 = fetch_transfers("2026", session)
    time.sleep(1.5)

    if has_real_2026_data:
        # TM kader page already published — use it directly
        teams_2026 = _build_teams(scraped_2026, SQUAD_2026_FILE)
        pending = False
    else:
        # TM kader page not yet published — build from 2025 + transfers
        teams_2026 = [dict(t) for t in teams_2025]
        pending = True

    # Apply transfers to Profis squad regardless
    profis_idx = next((i for i, t in enumerate(teams_2026) if t["id"] == "profis"), None)
    if profis_idx is not None and (incoming_2026 or outgoing_ids_2026):
        base = [p for p in teams_2026[profis_idx]["players"] if p.get("tm_id", 0) not in outgoing_ids_2026]
        existing_ids = {p.get("tm_id", 0) for p in base}
        for np in incoming_2026:
            if np.get("tm_id", 0) not in existing_ids and np.get("tm_id", 0) != 0:
                base.append(np)
                existing_ids.add(np["tm_id"])
        # Re-number
        for i, p in enumerate(base, 1):
            p["id"] = i
        teams_2026[profis_idx] = dict(teams_2026[profis_idx])
        teams_2026[profis_idx]["players"] = base
        teams_2026[profis_idx]["squadValue"] = squad_value_sum(base)
        if incoming_2026:
            pending = False  # We have real transfer data — not a blind copy anymore
        print(
            f"  [transfers applied] +{len(incoming_2026)} Zugänge, -{len(outgoing_ids_2026)} Abgänge → {len(base)} Profis",
            file=sys.stderr,
        )

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
