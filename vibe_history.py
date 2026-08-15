#!/usr/bin/env python3
"""BVB-Aladin Vibe-Historie — Tages-Score des Echte-Liebe-Vibe-Index -> vibe_history.json.

Python-Port der Kern-Formel aus bvb-fanpage/lib/vibe-index.ts (dort rechnet die
Fanpage den LIVE-Wert; hier entsteht die Zeitreihe fürs Sparkline-Chart, das
bvb-fanpage/lib/vibe-history.ts liest). Beide Seiten müssen dasselbe Ergebnis
liefern — Änderungen an der Formel gehören in BEIDE Dateien.

Formel (identisch zur TS-Vorlage):
    1. Items der letzten 24h (ohne published -> ausgeschlossen)
    2. Zeit-Decay  w = exp(-ln2 * alter_h / HALF_LIFE)   HALF_LIFE = 8h
    3. avgScore    = sum(score*w) / sum(w)               0..10
    4. fanRatio    = Anteil Items mit tier >= 4          0..1
    5. activity    = min(1, log1p(n) / log1p(40))        0..1
    6. raw         = avgScore/10 * 0.60 + activity * 0.25 + fanRatio * 0.15
    7. score       = round(raw * 100)                    0..100
    Labels: >=80 explodiert, >=60 heiß, >=40 lebendig, >=20 ruhig, sonst still

Output data/vibe_history.json (Vertrag mit der Fanpage):
    {"updated_at": ISO, "days": [{"date": "YYYY-MM-DD", "score": int, "label": str}]}
    Ein Eintrag pro Kalendertag (Europe/Berlin) — der letzte Lauf des Tages gewinnt.
    Der Tagesstempel folgt bewusst der Ortszeit: unter UTC schrieben die Läufe
    zwischen 00:00 und 01:59 MESZ noch auf den Slot des Vortages.
    Es werden die letzten KEEP_DAYS Tage aufsteigend sortiert gehalten.

FAILSAFE: Fehlt/kaputt ist news.json, bleibt vibe_history.json unangetastet und
der Prozess endet mit Exit 0. Eine kaputte vibe_history.json wird verworfen und
neu aufgebaut (der heutige Tag ist wichtiger als eine unlesbare Historie).
"""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).parent
NEWS_FILE = ROOT / "data" / "news.json"
HISTORY_FILE = ROOT / "data" / "vibe_history.json"

# Tagesgrenze der Historie: Ortszeit, nicht UTC (siehe Modul-Docstring).
LOCAL_TZ = ZoneInfo("Europe/Berlin")

HALF_LIFE_H = 8.0
ACTIVITY_CEILING = 40
WINDOW_H = 24.0
KEEP_DAYS = 21


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def age_hours(item: dict, now: datetime) -> float:
    """Ohne Timestamp nicht dem 24h-Fenster zuordenbar -> inf (fliegt raus)."""
    pub = parse_iso(item.get("published"))
    if pub is None:
        return math.inf
    return max(0.0, (now - pub).total_seconds() / 3600.0)


def label_for(score: int) -> str:
    if score >= 80:
        return "explodiert"
    if score >= 60:
        return "heiß"
    if score >= 40:
        return "lebendig"
    if score >= 20:
        return "ruhig"
    return "still"


def compute_vibe(items: list[dict], now: datetime) -> tuple[int, str]:
    """Vibe-Score 0..100 + Label für das 24h-Fenster."""
    recent = [it for it in items if age_hours(it, now) <= WINDOW_H]
    if not recent:
        return 0, "still"

    weight_sum = 0.0
    weighted_score = 0.0
    fan_count = 0
    for it in recent:
        w = math.exp(-math.log(2) * age_hours(it, now) / HALF_LIFE_H)
        weight_sum += w
        weighted_score += float(it.get("score") or 0.0) * w
        if int(it.get("tier") or 0) >= 4:
            fan_count += 1

    avg_score = weighted_score / weight_sum if weight_sum > 0 else 0.0   # 0..10
    fan_ratio = fan_count / len(recent)                                  # 0..1
    activity = min(1.0, math.log1p(len(recent)) / math.log1p(ACTIVITY_CEILING))

    raw = (avg_score / 10.0) * 0.60 + activity * 0.25 + fan_ratio * 0.15
    # JS Math.round rundet .5 immer auf — Pythons round() nicht. Bewusst floor(x+0.5).
    score = int(math.floor(min(100.0, max(0.0, raw * 100.0)) + 0.5))
    return score, label_for(score)


def load_history() -> list[dict]:
    """Bestehende Tage. Unlesbare Datei -> leere Historie (Warnung nach stderr)."""
    if not HISTORY_FILE.exists():
        return []
    try:
        data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        days = data.get("days", [])
        return [d for d in days if isinstance(d, dict) and isinstance(d.get("date"), str)]
    except Exception as exc:
        print(f"  [WARN] vibe_history.json unreadable ({type(exc).__name__}) — rebuilding",
              file=sys.stderr)
        return []


def upsert_day(days: list[dict], date: str, score: int, label: str) -> list[dict]:
    """Einen Tag setzen/überschreiben, aufsteigend sortiert, auf KEEP_DAYS kürzen."""
    by_date = {d["date"]: d for d in days}
    by_date[date] = {"date": date, "score": score, "label": label}
    ordered = sorted(by_date.values(), key=lambda d: d["date"])
    return ordered[-KEEP_DAYS:]


def main() -> int:
    if not NEWS_FILE.exists():
        print(f"  [WARN] {NEWS_FILE} missing — leaving vibe_history.json untouched",
              file=sys.stderr)
        return 0
    try:
        news = json.loads(NEWS_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"  [WARN] news.json unreadable: {type(exc).__name__}: {exc} — "
              f"leaving vibe_history.json untouched", file=sys.stderr)
        return 0

    now = now_utc()
    score, label = compute_vibe(news.get("items", []), now)
    today = now.astimezone(LOCAL_TZ).date().isoformat()
    days = upsert_day(load_history(), today, score, label)

    payload = {"updated_at": now.isoformat(), "days": days}
    HISTORY_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"vibe: {today} score {score} ({label}), {len(days)} days in history -> {HISTORY_FILE}",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
