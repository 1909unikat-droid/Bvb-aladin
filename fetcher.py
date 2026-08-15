#!/usr/bin/env python3
"""BVB-Aladin Fetcher — sammelt News aus RSS + X(via Nitter) und schreibt Roh-Items."""
from __future__ import annotations

import functools
import hashlib
import html
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse

import feedparser
import requests

ROOT = Path(__file__).parent
SOURCES_FILE = ROOT / "data" / "sources.json"
RAW_FILE = ROOT / "data" / "raw_items.json"
STATE_FILE = ROOT / "data" / "source_state.json"

# Frische-Wächter: ab wann gilt eine Quelle als verstummt.
STALE_AFTER_DAYS = 30
# 0 Items in so vielen Läufen in Folge = kein transienter Fetch-Fehler mehr.
EMPTY_RUNS_ALARM = 2

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) "
                  "AppleWebKit/605.1.15 BVB-Aladin/1.0"
}
TIMEOUT = 12


def load_sources() -> dict:
    return json.loads(SOURCES_FILE.read_text(encoding="utf-8"))


@functools.lru_cache(maxsize=8)
def _keyword_pattern(needles: tuple[str, ...]) -> re.Pattern:
    """Wortgrenzen statt Substring: "groß" darf "große"/"Großteil" nicht treffen.

    Optionales Genitiv-s deckt "Guirassys"/"Watzkes"/"Dortmunds" ab.
    Lookarounds statt \\b, damit auch Keywords mit Nicht-Wort-Randzeichen
    (z. B. "#bvb") korrekt begrenzt würden; \\w ist in Python Unicode-aware (ä/ö/ü/ß).
    """
    alt = "|".join(re.escape(n.lower()) for n in needles)
    return re.compile(rf"(?<!\w)(?:{alt})s?(?!\w)")


def text_contains_any(text: str, needles: list[str]) -> bool:
    if not needles:
        return False
    return _keyword_pattern(tuple(needles)).search(text.lower()) is not None


def strip_html(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_dt(entry) -> str | None:
    for key in ("published_parsed", "updated_parsed"):
        v = entry.get(key)
        if v:
            try:
                return datetime(*v[:6], tzinfo=timezone.utc).isoformat()
            except Exception:
                pass
    return None


def make_id(url: str, title: str) -> str:
    h = hashlib.sha1((url + "||" + title).encode("utf-8")).hexdigest()
    return h[:16]


# --- Bild-Extraktion ------------------------------------------------------
# Feeds liefern Bilder in vier Dialekten: media:content, media:thumbnail,
# <enclosure>, itunes:image — plus ein <img> im HTML-Body. YouTube-Feeds haben
# keine echte URL, das Thumbnail wird aus der Video-ID abgeleitet.
IMG_SRC_RE = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.I)

# Tracking-Pixel sind praktisch immer GIFs oder tragen einen dieser Marker im
# Pfad. Die Größe (<1 KB) lässt sich ohne Extra-Request nicht prüfen — dieser
# Namens-Filter ist die billige Näherung, die im Zweifel lieber verwirft.
TRACKER_HINTS = ("pixel", "spacer", "beacon", "/track", "blank.")
# '1x1' nur als eigenständiges Dimensions-Token — als Substring steckt es auch
# in legitimen Größen-Suffixen (foto-961x1024.jpg wäre sonst rausgeflogen).
TRACKER_1X1_RE = re.compile(r"(?<!\d)1x1(?!\d)")


def clean_image_url(url: str | None) -> str | None:
    """https-Bild-URL oder None (http, GIF-Tracker und Zählpixel fliegen raus)."""
    u = (url or "").strip()
    if not u.startswith("https://"):
        return None
    low = u.lower()
    if ".gif" in low or TRACKER_1X1_RE.search(low) or any(h in low for h in TRACKER_HINTS):
        return None
    return u


def _media_urls(entry, key: str) -> list[tuple[int, str]]:
    """(Breite, URL) aus media:content / media:thumbnail — Nicht-Bilder raus."""
    out: list[tuple[int, str]] = []
    for m in entry.get(key) or []:
        if not isinstance(m, dict):
            continue
        medium = (m.get("medium") or "").lower()
        mtype = (m.get("type") or "").lower()
        if medium and medium != "image":
            continue
        if mtype and not mtype.startswith("image/"):
            continue
        try:
            width = int(str(m.get("width") or 0))
        except ValueError:
            width = 0
        out.append((width, m.get("url") or ""))
    return out


def extract_image(entry) -> str | None:
    """Beste Bild-URL eines Feed-Items. None, wenn der Feed keins mitliefert."""
    video_id = entry.get("yt_videoid")
    if video_id:
        return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    # media:content ist das Vollbild, media:thumbnail nur die Vorschau — erst alle
    # media:content-Kandidaten (größte Breite zuerst), Thumbnails nur als Fallback.
    for key in ("media_content", "media_thumbnail"):
        for _, url in sorted(_media_urls(entry, key), key=lambda c: c[0], reverse=True):
            img = clean_image_url(url)
            if img:
                return img

    for enc in (entry.get("enclosures") or []) + (entry.get("links") or []):
        if not isinstance(enc, dict):
            continue
        if not (enc.get("type") or "").lower().startswith("image/"):
            continue
        img = clean_image_url(enc.get("href") or enc.get("url"))
        if img:
            return img

    itunes = entry.get("image")
    if isinstance(itunes, dict):
        img = clean_image_url(itunes.get("href"))
        if img:
            return img

    # Letzter Ausweg: erstes <img> im HTML-Body.
    bodies = [c.get("value", "") for c in (entry.get("content") or []) if isinstance(c, dict)]
    bodies += [entry.get("summary", ""), entry.get("description", "")]
    for body in bodies:
        for m in IMG_SRC_RE.finditer(body or ""):
            img = clean_image_url(m.group(1))
            if img:
                return img
    return None


def fetch_rss(feed_url: str) -> list[dict]:
    """Return parsed feed entries; raise on hard failure."""
    r = requests.get(feed_url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    fp = feedparser.parse(r.content)
    return fp.entries or []


def to_item(entry, source: dict) -> dict | None:
    title = strip_html(entry.get("title", "")).strip()
    link = (entry.get("link") or "").strip()
    summary = strip_html(entry.get("summary", "") or entry.get("description", ""))
    if not title:
        # Bluesky-RSS liefert Posts ganz ohne <title>. Ohne diesen Fallback fiele
        # die komplette Quelle stumm durchs Raster (alle Items -> None).
        # Entities zuerst auflösen (strip_html lässt sie stehen), dann an einer
        # Wortgrenze kürzen — sonst endet der Titel mitten in "&amp;".
        fallback = html.unescape(summary).strip()
        if len(fallback) > 120:
            fallback = fallback[:120].rsplit(" ", 1)[0]
        title = fallback.strip()
    if not title or not link:
        return None
    published = parse_dt(entry)
    item = {
        "id": make_id(link, title),
        "title": title,
        "summary": summary[:500],
        "url": link,
        "published": published,
        "source_id": source["id"],
        "source_name": source["name"],
        "tier": source["tier"],
        "credibility": source["credibility"],
        "host": urlparse(link).netloc,
        "lang": source.get("lang", "de"),
        "kind": source.get("kind", "rss"),
    }
    # Optionales Feld: nur setzen, wenn der Feed wirklich ein Bild liefert.
    image = extract_image(entry)
    if image:
        item["image"] = image
    return item


def fetch_rss_sources(sources: dict, bvb_keywords: list[str], freshness: dict) -> tuple[list[dict], int, int]:
    items, ok, fail = [], 0, 0
    for src in sources["rss"]:
        try:
            entries = fetch_rss(src["url"])
            record_freshness(freshness, src["id"], entries)
            for e in entries:
                it = to_item(e, src)
                if not it:
                    continue
                if src.get("filter_bvb"):
                    blob = f"{it['title']} {it['summary']}"
                    if not text_contains_any(blob, bvb_keywords):
                        continue
                items.append(it)
            ok += 1
            print(f"  [ok]  {src['name']:30s} -> {len(entries)} entries", file=sys.stderr)
        except Exception as exc:
            fail += 1
            record_freshness(freshness, src["id"], None)
            print(f"  [FAIL] {src['name']:30s} -> {type(exc).__name__}: {exc}", file=sys.stderr)
    return items, ok, fail


def fetch_nitter_account(handle: str, instances: list[str]) -> list[dict] | None:
    """Try Nitter mirrors in order; return raw feedparser entries-like or None."""
    for inst in instances:
        url = f"{inst.rstrip('/')}/{handle}/rss"
        try:
            entries = fetch_rss(url)
            if entries:
                return entries
        except Exception:
            continue
    return None


def fetch_nitter_search(query: str, instances: list[str]) -> list[dict] | None:
    """Nitter-Volltextsuche über dieselbe Mirror-Kette wie die Accounts."""
    for inst in instances:
        url = f"{inst.rstrip('/')}/search/rss?f=tweets&q={quote(query)}"
        try:
            entries = fetch_rss(url)
            if entries:
                return entries
        except Exception:
            continue
    return None


def fetch_x_searches(sources: dict, bvb_keywords: list[str], freshness: dict) -> tuple[list[dict], int, int]:
    """Nitter-Suchen. Treffer sind Fremd-Tweets -> IMMER auf BVB-Keywords filtern."""
    nitter = sources.get("nitter", {})
    searches = nitter.get("searches", [])
    instances = nitter.get("instances", [])
    items, ok, fail = [], 0, 0
    for s in searches:
        src = {
            "id": s["id"],
            "name": s.get("name") or f"X-Suche: {s['query']}",
            "tier": s["tier"],
            "credibility": s["credibility"],
            "lang": s.get("lang", "de"),
            "kind": "x",
        }
        entries = fetch_nitter_search(s["query"], instances)
        record_freshness(freshness, s["id"], entries)
        if entries is None:
            fail += 1
            print(f"  [FAIL] X-Suche/{s['query']:15s} -> all nitter mirrors failed", file=sys.stderr)
            continue
        kept = 0
        for e in entries:
            it = to_item(e, src)
            if not it:
                continue
            blob = f"{it['title']} {it['summary']}"
            if not text_contains_any(blob, bvb_keywords):
                continue
            items.append(it)
            kept += 1
        ok += 1
        print(f"  [ok]  X-Suche/{s['query']:15s} -> {len(entries)} tweets, {kept} BVB-relevant", file=sys.stderr)
    return items, ok, fail


def fetch_x_sources(sources: dict, bvb_keywords: list[str], freshness: dict) -> tuple[list[dict], int, int]:
    nitter = sources.get("nitter", {})
    accounts = nitter.get("accounts", [])
    instances = nitter.get("instances", [])
    filter_non_bvb = nitter.get("filter_bvb_for_non_bvb_accounts", True)
    items, ok, fail = [], 0, 0
    for acc in accounts:
        src = {
            "id": acc["id"],
            "name": acc["name"],
            "tier": acc["tier"],
            "credibility": acc["credibility"],
            "lang": acc.get("lang", "en"),
            "kind": "x",
        }
        entries = fetch_nitter_account(acc["handle"], instances)
        record_freshness(freshness, acc["id"], entries)
        if entries is None:
            fail += 1
            print(f"  [FAIL] X/{acc['handle']:20s} -> all nitter mirrors failed", file=sys.stderr)
            continue
        # Tweets von Nicht-BVB-Accounts (Romano, Ornstein, Falk, Plettenberg) auf BVB filtern.
        is_bvb_account = acc["handle"].lower() == "bvb"
        kept = 0
        for e in entries:
            it = to_item(e, src)
            if not it:
                continue
            if filter_non_bvb and not is_bvb_account:
                blob = f"{it['title']} {it['summary']}"
                if not text_contains_any(blob, bvb_keywords):
                    continue
            items.append(it)
            kept += 1
        ok += 1
        print(f"  [ok]  X/{acc['handle']:20s} -> {len(entries)} tweets, {kept} BVB-relevant", file=sys.stderr)
    return items, ok, fail


# --- Quellen-Frische-Wächter ---------------------------------------------
# Tote Accounts (404-Handle, seit Jahren stiller Reporter) liefern still 0 oder
# uralte Items und fallen im Log zwischen 40 [ok]-Zeilen nicht auf. Der Wächter
# merkt sich pro Quelle das neueste je gesehene Item und meldet Verstummte.


def record_freshness(freshness: dict, source_id: str, entries: list | None) -> None:
    """Neuestes Item-Datum einer Quelle festhalten — VOR den BVB-Filtern.

    Gemessen wird "sendet die Quelle überhaupt noch?", nicht "liefert sie BVB":
    sonst schlüge der Wächter auf gefilterten Feeds an jedem ruhigen BVB-Tag an.
    """
    newest = None
    for e in entries or []:
        dt = parse_dt(e)
        if dt and (newest is None or dt > newest):
            newest = dt
    # entries is None = Fetch-FEHLER (Mirror/Netz) — zählt nicht als "Feed leer",
    # sonst meldet eine Stunde Nitter-Ausfall frisch deployte Quellen als stale.
    freshness[source_id] = {
        "newest": newest,
        "count": len(entries or []),
        "failed": entries is None,
    }


def load_state() -> dict:
    """Gemerkter Stand des letzten Laufs. Fehlt/kaputt -> leer (kein Abbruch)."""
    if not STATE_FILE.exists():
        return {}
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        sources = data.get("sources") if isinstance(data, dict) else None
        return sources if isinstance(sources, dict) else {}
    except Exception as exc:
        print(f"  [WARN] source_state.json unlesbar ({type(exc).__name__}) — Wächter startet neu",
              file=sys.stderr)
        return {}


def _parse_state_dt(s: str | None) -> datetime | None:
    # TypeError mit abfangen: ein handeditierter State kann Nicht-Strings tragen.
    try:
        return datetime.fromisoformat(s) if s else None
    except (ValueError, TypeError):
        return None


def check_freshness(freshness: dict, now: datetime) -> list[dict]:
    """Verstummte Quellen finden und den Wächter-State fortschreiben.

    Alarm gibt es aus zwei Gründen:
      (a) das neueste je gesehene Item ist älter als STALE_AFTER_DAYS,
      (b) die Quelle lieferte noch nie ein Item und war EMPTY_RUNS_ALARM Läufe
          in Folge leer (toter Handle, 404-Feed).
    Das gemerkte Datum überlebt Läufe: ein einzelner Netz- oder Mirror-Fehler
    kann eine lebende Quelle deshalb nicht fälschlich stumm schalten.
    """
    previous = load_state()
    state: dict[str, dict] = {}
    stale: list[dict] = []

    for sid, seen in sorted(freshness.items()):
        old = previous.get(sid) if isinstance(previous.get(sid), dict) else {}
        # ISO-Strings mit identischem UTC-Offset -> lexikographischer Vergleich
        # reicht. Nicht-String-Werte (handeditierter State) -> wie fehlend.
        newest = old.get("newest_item")
        if not isinstance(newest, str):
            newest = None
        if seen["newest"] and (not newest or seen["newest"] > newest):
            newest = seen["newest"]
        old_empty = old.get("empty_runs")
        old_empty = old_empty if isinstance(old_empty, int) else 0
        if seen["count"]:
            empty_runs = 0
        elif seen.get("failed"):
            empty_runs = old_empty  # Fetch-Fehler: Zähler einfrieren, nicht werten
        else:
            empty_runs = old_empty + 1
        since = old.get("since")
        since = since if isinstance(since, str) else now.isoformat()
        state[sid] = {"newest_item": newest, "empty_runs": empty_runs, "since": since}

        reference = _parse_state_dt(newest) or _parse_state_dt(since)
        days_silent = max(int((now - reference).total_seconds() // 86400), 0) if reference else 0
        if (newest and days_silent > STALE_AFTER_DAYS) or (not newest and empty_runs >= EMPTY_RUNS_ALARM):
            stale.append({"id": sid, "newest_item": newest, "days_silent": days_silent})

    try:
        # Atomar (tmp + replace): überlappende Läufe dürfen keinen zerrissenen
        # State hinterlassen — der Reset kostete sonst das newest-Gedächtnis.
        tmp = STATE_FILE.with_suffix(".tmp")
        tmp.write_text(
            json.dumps({"updated_at": now.isoformat(), "sources": state},
                       ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp.replace(STATE_FILE)
    except OSError as exc:
        print(f"  [WARN] source_state.json nicht schreibbar: {exc}", file=sys.stderr)

    stale.sort(key=lambda s: s["days_silent"], reverse=True)
    for s in stale:
        print(f"  [WARN] Quelle {s['id']} still seit {s['days_silent']} Tagen", file=sys.stderr)
    return stale


def main() -> int:
    started = time.time()
    sources = load_sources()
    bvb_keywords = sources.get("bvb_keywords", [])
    negative = sources.get("negative_keywords", [])

    freshness: dict[str, dict] = {}

    print("== RSS sources ==", file=sys.stderr)
    rss_items, rss_ok, rss_fail = fetch_rss_sources(sources, bvb_keywords, freshness)

    print("== X / Nitter ==", file=sys.stderr)
    x_items, x_ok, x_fail = fetch_x_sources(sources, bvb_keywords, freshness)
    s_items, s_ok, s_fail = fetch_x_searches(sources, bvb_keywords, freshness)
    x_items += s_items
    x_ok += s_ok
    x_fail += s_fail

    items = rss_items + x_items

    # Negative filter (Mönchengladbach etc.) — nur wenn KEIN positiver BVB-Match drinsteht.
    cleaned: list[dict] = []
    for it in items:
        blob = f"{it['title']} {it['summary']}".lower()
        has_bvb = text_contains_any(blob, bvb_keywords)
        # Negative bewusst weiter Substring: soll Komposita wie "Gladbach-Coach"
        # und "Mönchengladbachs" großzügig fangen — droppt nur ohne BVB-Match.
        has_neg = any(n.lower() in blob for n in negative)
        if has_neg and not has_bvb:
            continue
        cleaned.append(it)

    print("== Quellen-Frische ==", file=sys.stderr)
    # Der Wächter ist Diagnose, nie Blocker: ein kaputter State darf den
    # Fetch-Lauf (und damit news.json) nicht mit in den Abgrund reißen.
    try:
        stale = check_freshness(freshness, datetime.now(timezone.utc))
    except Exception as exc:
        print(f"  [WARN] Frische-Wächter übersprungen ({type(exc).__name__}: {exc})",
              file=sys.stderr)
        stale = []

    payload = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "duration_s": round(time.time() - started, 2),
        "sources_ok": rss_ok + x_ok,
        "sources_fail": rss_fail + x_fail,
        "stale_sources": stale,
        "items": cleaned,
    }
    RAW_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"\nfetched {len(cleaned)} items "
        f"(rss ok/fail {rss_ok}/{rss_fail}, x ok/fail {x_ok}/{x_fail}) "
        f"in {payload['duration_s']}s -> {RAW_FILE}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
