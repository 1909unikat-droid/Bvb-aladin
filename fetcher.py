#!/usr/bin/env python3
"""BVB-Aladin Fetcher — sammelt News aus RSS + X(via Nitter) und schreibt Roh-Items."""
from __future__ import annotations

import hashlib
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

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) "
                  "AppleWebKit/605.1.15 BVB-Aladin/1.0"
}
TIMEOUT = 12


def load_sources() -> dict:
    return json.loads(SOURCES_FILE.read_text(encoding="utf-8"))


def text_contains_any(text: str, needles: list[str]) -> bool:
    t = text.lower()
    return any(n.lower() in t for n in needles)


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
TRACKER_HINTS = ("1x1", "pixel", "spacer", "beacon", "/track", "blank.")


def clean_image_url(url: str | None) -> str | None:
    """https-Bild-URL oder None (http, GIF-Tracker und Zählpixel fliegen raus)."""
    u = (url or "").strip()
    if not u.startswith("https://"):
        return None
    low = u.lower()
    if ".gif" in low or any(h in low for h in TRACKER_HINTS):
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

    # media:content / media:thumbnail — größte Variante gewinnt.
    candidates = _media_urls(entry, "media_content") + _media_urls(entry, "media_thumbnail")
    for _, url in sorted(candidates, key=lambda c: c[0], reverse=True):
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
    if not title or not link:
        return None
    summary = strip_html(entry.get("summary", "") or entry.get("description", ""))
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


def fetch_rss_sources(sources: dict, bvb_keywords: list[str]) -> tuple[list[dict], int, int]:
    items, ok, fail = [], 0, 0
    for src in sources["rss"]:
        try:
            entries = fetch_rss(src["url"])
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


def fetch_x_searches(sources: dict, bvb_keywords: list[str]) -> tuple[list[dict], int, int]:
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


def fetch_x_sources(sources: dict, bvb_keywords: list[str]) -> tuple[list[dict], int, int]:
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


def main() -> int:
    started = time.time()
    sources = load_sources()
    bvb_keywords = sources.get("bvb_keywords", [])
    negative = sources.get("negative_keywords", [])

    print("== RSS sources ==", file=sys.stderr)
    rss_items, rss_ok, rss_fail = fetch_rss_sources(sources, bvb_keywords)

    print("== X / Nitter ==", file=sys.stderr)
    x_items, x_ok, x_fail = fetch_x_sources(sources, bvb_keywords)
    s_items, s_ok, s_fail = fetch_x_searches(sources, bvb_keywords)
    x_items += s_items
    x_ok += s_ok
    x_fail += s_fail

    items = rss_items + x_items

    # Negative filter (Mönchengladbach etc.) — nur wenn KEIN positiver BVB-Match drinsteht.
    cleaned: list[dict] = []
    for it in items:
        blob = f"{it['title']} {it['summary']}".lower()
        has_bvb = any(k.lower() in blob for k in bvb_keywords)
        has_neg = any(n.lower() in blob for n in negative)
        if has_neg and not has_bvb:
            continue
        cleaned.append(it)

    payload = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "duration_s": round(time.time() - started, 2),
        "sources_ok": rss_ok + x_ok,
        "sources_fail": rss_fail + x_fail,
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
