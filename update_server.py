#!/usr/bin/env python3
"""BVB-Aladin Server — serviert UI + /api/news + /api/refresh auf Port 8766."""
from __future__ import annotations

import json
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).parent
NEWS_FILE = ROOT / "data" / "news.json"
PORT = 8766

# In-Process Refresh-Lock — verhindert parallele Fetches.
_refresh_lock = threading.Lock()
_last_refresh_ts: float = 0.0
_min_interval_s: float = 60.0  # API-Refresh max 1×/min


def run_pipeline() -> tuple[bool, str]:
    """Run fetcher.py then scorer.py. Returns (ok, log)."""
    log_lines: list[str] = []
    for script in ("fetcher.py", "scorer.py"):
        try:
            res = subprocess.run(
                [sys.executable, str(ROOT / script)],
                capture_output=True, text=True, timeout=180,
            )
            log_lines.append(f"--- {script} (rc={res.returncode}) ---")
            log_lines.append(res.stderr.strip() or "(no stderr)")
            if res.returncode != 0:
                return False, "\n".join(log_lines)
        except subprocess.TimeoutExpired:
            log_lines.append(f"--- {script} TIMEOUT ---")
            return False, "\n".join(log_lines)
        except Exception as exc:
            log_lines.append(f"--- {script} ERROR: {exc} ---")
            return False, "\n".join(log_lines)
    return True, "\n".join(log_lines)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {fmt % args}\n")

    def _send_json(self, code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path, content_type: str):
        try:
            data = path.read_bytes()
        except FileNotFoundError:
            self.send_error(404, f"not found: {path.name}")
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store" if path.suffix == ".json" else "max-age=300")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        global _last_refresh_ts
        path = self.path.split("?")[0]

        if path == "/api/news":
            if NEWS_FILE.exists():
                self._send_file(NEWS_FILE, "application/json; charset=utf-8")
            else:
                self._send_json(503, {"error": "news.json missing, trigger /api/refresh"})
            return

        if path == "/api/refresh":
            elapsed = time.time() - _last_refresh_ts
            if elapsed < _min_interval_s:
                self._send_json(429, {
                    "ok": False,
                    "error": f"rate limited, retry in {int(_min_interval_s - elapsed)}s",
                })
                return
            if not _refresh_lock.acquire(blocking=False):
                self._send_json(409, {"ok": False, "error": "refresh already running"})
                return
            try:
                ok, log = run_pipeline()
                _last_refresh_ts = time.time()
                self._send_json(200 if ok else 500, {"ok": ok, "log": log})
            finally:
                _refresh_lock.release()
            return

        if path == "/api/health":
            self._send_json(200, {
                "ok": True,
                "news_exists": NEWS_FILE.exists(),
                "last_refresh_age_s": int(time.time() - _last_refresh_ts) if _last_refresh_ts else None,
            })
            return

        # static
        if path == "/" or path == "":
            self._send_file(ROOT / "index.html", "text/html; charset=utf-8")
            return
        if path == "/manifest.json":
            self._send_file(ROOT / "manifest.json", "application/manifest+json")
            return
        if path == "/sw.js":
            self._send_file(ROOT / "sw.js", "application/javascript")
            return
        if path.startswith("/icons/"):
            fname = path.split("/", 2)[2]
            self._send_file(ROOT / "icons" / fname, "image/png")
            return
        if path.startswith("/data/"):
            fname = path.split("/", 2)[2]
            self._send_file(ROOT / "data" / fname, "application/json; charset=utf-8")
            return

        self.send_error(404, "not found")


def background_refresher(interval_min: int):
    """Triggert alle interval_min Minuten run_pipeline."""
    global _last_refresh_ts
    while True:
        if _refresh_lock.acquire(blocking=False):
            try:
                ok, _ = run_pipeline()
                _last_refresh_ts = time.time()
                print(f"[bg] pipeline ok={ok}", file=sys.stderr)
            finally:
                _refresh_lock.release()
        time.sleep(interval_min * 60)


def main() -> int:
    # Erst-Refresh sofort im Hintergrund, dann alle 30 min.
    t = threading.Thread(target=background_refresher, args=(30,), daemon=True)
    t.start()

    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"BVB-Aladin server on http://127.0.0.1:{PORT}", file=sys.stderr)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
