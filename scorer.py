#!/usr/bin/env python3
"""BVB-Aladin Scorer — dedupe, kategorisiert, scort und schreibt news.json."""
from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
SOURCES_FILE = ROOT / "data" / "sources.json"
RAW_FILE = ROOT / "data" / "raw_items.json"
NEWS_FILE = ROOT / "data" / "news.json"

# Stopwords für naive Title-Fingerprints (Dedup ohne Embeddings im MVP).
STOPWORDS = {
    "der", "die", "das", "den", "dem", "ein", "eine", "einen", "einer", "eines",
    "und", "oder", "aber", "auch", "nicht", "nur", "noch", "schon",
    "in", "im", "am", "an", "auf", "aus", "bei", "mit", "zu", "zum", "zur",
    "für", "fuer", "von", "vor", "nach", "über", "ueber", "unter", "durch",
    "ist", "sind", "war", "hat", "haben", "wird", "werden", "wurde",
    "the", "a", "an", "of", "to", "for", "and", "or", "is", "are", "was", "be",
    "with", "in", "on", "at", "from", "by",
    "bvb", "borussia", "dortmund",  # zu generisch für Dedup
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def tokens_for_fp(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"[^\wäöüß ]+", " ", text, flags=re.UNICODE)
    toks = [t for t in text.split() if len(t) >= 3 and t not in STOPWORDS]
    return toks


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def categorize(text: str, categories: dict) -> str:
    text_l = text.lower()
    best = "other"
    best_hits = 0
    for cat, kws in categories.items():
        hits = sum(1 for k in kws if k in text_l)
        if hits > best_hits:
            best, best_hits = cat, hits
    return best


def specificity_score(text: str) -> float:
    """Specificity: konkrete Zahlen, Namen, Euro-Beträge → Score 0..1."""
    score = 0.0
    if re.search(r"\b\d{1,3}[\.,]?\d{0,3}\s?(mio|millionen|m€|m\$|€|euro)\b", text, re.I):
        score += 0.5
    if re.search(r"\b(20[2-3]\d|bis\s+\d{4})\b", text):  # Vertragslaufzeit/Jahre
        score += 0.2
    if re.search(r"\b[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+\b", text):  # Vor+Nachname
        score += 0.2
    if "offiziell" in text.lower() or "official" in text.lower():
        score += 0.3
    return min(score, 1.0)


def player_relevance(text: str, keywords: list[str]) -> float:
    """Anzahl Treffer (Spieler/Funktionäre) → 0..1."""
    text_l = text.lower()
    hits = sum(1 for k in keywords if k.lower() in text_l)
    return min(hits / 3.0, 1.0)  # 3+ Treffer = max


def recency_decay(published: datetime | None, now: datetime, half_life_h: float = 18.0) -> float:
    if not published:
        return 0.3  # unbekanntes Datum: konservativ
    age_h = max((now - published).total_seconds() / 3600.0, 0.0)
    return math.exp(-math.log(2) * age_h / half_life_h)


def cluster_items(items: list[dict], threshold: float = 0.45) -> list[list[dict]]:
    """Naive O(n²) Clustering via Title-Token-Jaccard. MVP-tauglich für <500 items."""
    fps = [set(tokens_for_fp(it["title"])) for it in items]
    clusters: list[list[int]] = []
    cluster_of: list[int] = [-1] * len(items)
    for i, fp in enumerate(fps):
        placed = False
        for ci, members in enumerate(clusters):
            # vergleiche mit Repräsentant (erstes Member)
            if jaccard(fp, fps[members[0]]) >= threshold:
                members.append(i)
                cluster_of[i] = ci
                placed = True
                break
        if not placed:
            clusters.append([i])
            cluster_of[i] = len(clusters) - 1
    return [[items[i] for i in members] for members in clusters]


def score_cluster(cluster: list[dict], keywords: list[str], categories: dict, now: datetime) -> dict:
    """Merge a cluster of duplicate stories into one ranked item."""
    # Repräsentant = höchste Credibility, dann neuester
    cluster.sort(
        key=lambda x: (x["credibility"], parse_iso(x["published"]) or datetime.min.replace(tzinfo=timezone.utc)),
        reverse=True,
    )
    rep = cluster[0]
    text = f"{rep['title']} {rep['summary']}"

    # Components 0..1
    cred = rep["credibility"] / 10.0
    confirm = min(len({c["source_id"] for c in cluster}) / 4.0, 1.0)  # 4+ Quellen = max
    pub_dt = parse_iso(rep["published"])
    rec = recency_decay(pub_dt, now)
    spec = specificity_score(text)
    rel = player_relevance(text, keywords)

    score = (0.35 * cred + 0.25 * confirm + 0.20 * rec + 0.10 * spec + 0.10 * rel) * 10.0
    category = categorize(text, categories)

    # Official BVB-Quelle (bvb.de oder @BVB) immer als "official" markieren
    if rep["source_id"] in ("bvb_official", "x_bvb"):
        category = "official"

    return {
        "id": rep["id"],
        "title": rep["title"],
        "summary": rep["summary"],
        "url": rep["url"],
        "published": rep["published"],
        "source": rep["source_name"],
        "source_id": rep["source_id"],
        "tier": rep["tier"],
        "kind": rep.get("kind", "rss"),
        "score": round(score, 2),
        "category": category,
        "confirmations": [
            {"source": c["source_name"], "url": c["url"], "tier": c["tier"]}
            for c in cluster
        ],
        "confirmation_count": len({c["source_id"] for c in cluster}),
        "components": {
            "credibility": round(cred, 3),
            "confirmation": round(confirm, 3),
            "recency": round(rec, 3),
            "specificity": round(spec, 3),
            "relevance": round(rel, 3),
        },
    }


def main() -> int:
    if not RAW_FILE.exists():
        print(f"raw items missing: {RAW_FILE}. Run fetcher.py first.", file=sys.stderr)
        return 1
    sources = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    raw = json.loads(RAW_FILE.read_text(encoding="utf-8"))
    keywords = sources.get("bvb_keywords", [])
    categories = sources.get("categories", {})
    now = now_utc()

    items = raw.get("items", [])
    # Filter: Items ohne Datum behalten, aber Items älter als 14 Tage raus.
    cutoff_h = 14 * 24
    fresh = []
    for it in items:
        pub = parse_iso(it.get("published"))
        if pub is None:
            fresh.append(it)
            continue
        if (now - pub).total_seconds() / 3600.0 <= cutoff_h:
            fresh.append(it)

    clusters = cluster_items(fresh)
    ranked = [score_cluster(c, keywords, categories, now) for c in clusters]
    ranked.sort(key=lambda x: x["score"], reverse=True)

    by_tier = Counter(it["tier"] for it in ranked)
    by_cat = Counter(it["category"] for it in ranked)
    payload = {
        "updated_at": now.isoformat(),
        "items": ranked,
        "stats": {
            "total": len(ranked),
            "raw_total": len(items),
            "clusters": len(clusters),
            "by_tier": dict(by_tier),
            "by_category": dict(by_cat),
            "sources_ok": raw.get("sources_ok", 0),
            "sources_fail": raw.get("sources_fail", 0),
        },
    }
    NEWS_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"scored {len(ranked)} clusters from {len(items)} raw items. "
        f"top tier 1 count: {by_tier.get(1, 0)}, official: {by_cat.get('official', 0)}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
