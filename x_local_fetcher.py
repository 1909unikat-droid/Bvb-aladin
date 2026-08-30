#!/usr/bin/env python3
"""x_local_fetcher.py — X-Posts der BVB-Insider über den eingeloggten Zweitaccount.

Läuft NUR lokal auf dem Mac (launchd via run_refresh.sh), NIE in der GitHub
Action: Der Zugriff braucht die X-Session des Zweitaccounts (@kryptost09) aus
dem macOS-Keychain, die das krypto-aladin-Werkzeug scripts/x_cli.py pflegt
(Safari-Write-through). Dieses Modul ruft x_cli als CLI-Werkzeug auf — bewusst
KEINE Code-Kopie: die heiklen Workarounds (Keychain-Kette, CT-Cache) leben
dort und werden dort gepflegt. Der Pfad ist in sources.json -> x_local.cli
konfiguriert; fehlt das Werkzeug, meldet sich das Modul und tut nichts.

Hintergrund (30.08.2026): Nitter ist nach dem X-Corp-C&D tot (sources.json ->
nitter_disabled). Krypto-Aladin liest X seit 08/2026 stabil über den
eingeloggten Zweitaccount (x_pulse.py) — hier dasselbe Muster mit GETEILTEM
Budget, klein dosiert, damit die Krypto-Läufe (4x16 Abfragen/Tag) den Account
nicht zusammen mit uns in die Drosselung treiben:
  * min. 7 h Abstand zwischen Läufen (Selbst-Gate über State-Datei),
  * Skip während der Krypto-Pipeline-Slots (07/11/16/21 Uhr lokal),
  * 6 Accounts je Lauf, 8 s Pause -> ~18 Abfragen/Tag zusätzlich.

X drosselt still (leere Listen statt Fehler, gemessen krypto-aladin
03.08.2026) — eine leere Antwort zählt deshalb NIE als "keine Posts".

Ergebnis: data/x_items.json mit fertigen Items im news-Schema (48-h-Fenster,
Merge mit Bestand — ein gedrosselter Lauf löscht keine guten Items).
push_x_items.sh veröffentlicht die Datei via Contents-API; das triggert den
Action-Refresh (refresh-news.yml, push-Pfad data/x_items.json), und
fetcher.load_x_local_items() mischt die Items in news.json ein.

Dieses Modul ist bewusst AUTARK (kein `import fetcher`): der lokale
Mac-Checkout trägt die Archiv-Historie und kann einen älteren fetcher.py
haben — ein Import würde dort auf anderem Code landen als hier getestet.

Usage:
  /usr/bin/python3 x_local_fetcher.py             # Standardlauf (mit Gates)
  /usr/bin/python3 x_local_fetcher.py --force     # Gates umgehen (Test)
  /usr/bin/python3 x_local_fetcher.py --dry-run   # abrufen, nichts schreiben
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).parent
SOURCES_FILE = ROOT / "data" / "sources.json"
OUT_FILE = ROOT / "data" / "x_items.json"
STATE_FILE = ROOT / "data" / ".x_local_state.json"

# Defaults — überschreibbar in sources.json -> x_local.
MIN_ABSTAND_S = 7 * 3600
POSTS_JE_ACCOUNT = 10
PAUSE_S = 8.0
MAX_ALTER_H = 24          # nur frische Posts aufnehmen
FENSTER_H = 48            # so lange bleiben Items in x_items.json
KRYPTO_SLOT_STUNDEN = [7, 11, 16, 21]
CLI_TIMEOUT_S = 90


def _keyword_pattern(needles: list[str]) -> re.Pattern:
    """Wortgrenzen + optionales Genitiv-s — gleiche Semantik wie
    fetcher.text_contains_any (bewusst kopiert statt importiert, s. Docstring)."""
    alt = "|".join(re.escape(n.lower()) for n in needles)
    return re.compile(rf"(?<!\w)(?:{alt})s?(?!\w)")


def _kuerze_titel(text: str, max_len: int = 120) -> str:
    t = re.sub(r"\s+", " ", text).strip()
    if len(t) > max_len:
        t = t[:max_len].rsplit(" ", 1)[0]
    return t.strip()


def _hole_posts(python_bin: str, cli: str, handle: str, n: int) -> list[dict] | None:
    """None = Abruf gescheitert/gedrosselt (NICHT als 'keine Posts' werten)."""
    try:
        p = subprocess.run(
            [python_bin, cli, "user-posts", handle, "-n", str(n), "--json"],
            capture_output=True, text=True, timeout=CLI_TIMEOUT_S)
        if p.returncode != 0 or not p.stdout.strip():
            return None
        d = json.loads(p.stdout)
        posts = d.get("data") if isinstance(d, dict) else d
        return posts if isinstance(posts, list) else None
    except Exception:
        return None


def _post_dt(ts: str) -> datetime | None:
    try:
        dt = parsedate_to_datetime(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def main() -> int:
    dry = "--dry-run" in sys.argv
    force = "--force" in sys.argv
    now = datetime.now(timezone.utc)

    sources = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    cfg = sources.get("x_local") or {}
    accounts = cfg.get("accounts", [])
    if not accounts:
        print("[x_local] keine Accounts konfiguriert (sources.json -> x_local) — skip")
        return 0

    slots = set(cfg.get("krypto_slot_stunden", KRYPTO_SLOT_STUNDEN))
    if not force and datetime.now().hour in slots:
        print(f"[x_local] Krypto-Pipeline-Slot ({datetime.now().hour} Uhr) — skip, "
              "der Zweitaccount gehört gerade den Krypto-Läufen")
        return 0

    min_abstand = int(cfg.get("min_abstand_s", MIN_ABSTAND_S))
    if not force:
        try:
            last = json.loads(STATE_FILE.read_text()).get("last_run")
            if last and (now - datetime.fromisoformat(last)).total_seconds() < min_abstand:
                print(f"[x_local] letzter Lauf <{min_abstand // 3600}h — skip (Budget-Gate)")
                return 0
        except Exception:
            pass  # kein/kaputter State = erster Lauf

    python_bin = str(Path(cfg.get("python", "~/.agent-reach-venv/bin/python")).expanduser())
    cli = str(Path(cfg.get("cli", "")).expanduser())
    if not (cli and Path(cli).exists() and Path(python_bin).exists()):
        print(f"[x_local] x_cli-Werkzeug nicht gefunden ({cli or 'unkonfiguriert'}) — "
              "skip. Pfad in sources.json -> x_local.cli prüfen "
              "(erwartet: krypto-aladin/scripts/x_cli.py).")
        return 0

    bvb_keywords = sources.get("bvb_keywords", [])
    kw_pattern = _keyword_pattern(bvb_keywords) if bvb_keywords else None
    pause = float(cfg.get("pause_s", PAUSE_S))
    posts_n = int(cfg.get("posts_je_account", POSTS_JE_ACCOUNT))
    grenze = now - timedelta(hours=float(cfg.get("max_alter_h", MAX_ALTER_H)))

    neue: list[dict] = []
    gescheitert: list[str] = []
    for i, acc in enumerate(accounts):
        if i:
            time.sleep(pause)
        posts = _hole_posts(python_bin, cli, acc["handle"], posts_n)
        if posts is None:
            gescheitert.append(acc["handle"])
            print(f"  [FAIL] X/{acc['handle']:18s} -> leer/gedrosselt", file=sys.stderr)
            continue
        kept = 0
        for p in posts:
            text = (p.get("text") or p.get("fullText") or "").strip()
            if not text:
                continue
            dt = _post_dt(p.get("createdAt") or p.get("created_at") or "")
            if dt is None or dt < grenze:
                continue
            if acc.get("filter_bvb", True) and kw_pattern and not kw_pattern.search(text.lower()):
                continue
            url = (p.get("url") or f"https://x.com/{acc['handle']}").strip()
            title = _kuerze_titel(text)
            if not title:
                continue
            neue.append({
                "id": hashlib.sha1((url + "||" + title).encode("utf-8")).hexdigest()[:16],
                "title": title,
                "summary": re.sub(r"\s+", " ", text).strip()[:500],
                "url": url,
                "published": dt.isoformat(),
                "source_id": acc["id"],
                "source_name": acc["name"],
                "tier": acc["tier"],
                "credibility": acc["credibility"],
                "host": urlparse(url).netloc,
                "lang": acc.get("lang", "de"),
                "kind": "x",
            })
            kept += 1
        print(f"  [ok]  X/{acc['handle']:18s} -> {len(posts)} posts, {kept} BVB-relevant",
              file=sys.stderr)

    # Merge mit Bestand: Fenster halten, damit ein gedrosselter Lauf nichts löscht.
    fenster = now - timedelta(hours=float(cfg.get("fenster_h", FENSTER_H)))
    bestand: list[dict] = []
    try:
        bestand = json.loads(OUT_FILE.read_text(encoding="utf-8")).get("items", [])
    except Exception:
        pass
    items: dict[str, dict] = {}
    for it in bestand + neue:
        try:
            if datetime.fromisoformat(it["published"]) < fenster:
                continue
        except (KeyError, ValueError):
            continue
        items[it["id"]] = it
    sortiert = sorted(items.values(), key=lambda x: x["published"], reverse=True)

    degraded = bool(gescheitert)
    payload = {
        "generated_at": now.isoformat(),
        "abgefragt": len(accounts),
        "gescheitert": gescheitert,
        "degraded": degraded,
        "honest_note": (
            f"UNVOLLSTÄNDIG: {len(gescheitert)}/{len(accounts)} Accounts leer/gedrosselt "
            f"({', '.join(gescheitert[:5])}). X drosselt mit leeren Listen statt Fehlern — "
            "das bedeutet NICHT, dass nichts gepostet wurde." if degraded else ""),
        "items": sortiert,
    }

    if dry:
        print(f"[x_local] DRY-RUN: {len(neue)} neue, {len(sortiert)} im Fenster, "
              f"{len(gescheitert)} gescheitert — nichts geschrieben")
        for it in sortiert[:5]:
            print(f"    [{it['source_id']}] {it['published']} {it['title'][:80]}")
        return 0

    tmp = OUT_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(OUT_FILE)
    try:
        STATE_FILE.write_text(json.dumps({"last_run": now.isoformat()}))
    except OSError:
        pass
    print(f"[x_local] {len(neue)} neue Posts, {len(sortiert)} im 48h-Fenster "
          f"({len(gescheitert)} Accounts gescheitert) -> {OUT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
