"""Local Python API plus dashboard. No web framework, keys or cloud account.

Run: python -m parallel.server
Do not expose this development server directly to the Internet.
"""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .engine import default_scenario, simulate

ROOT = Path(__file__).resolve().parent.parent / "dist"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = urlparse(self.path).path
        if route == "/api/health":
            self.reply(200, {"status": "ok", "engine": "Python / NumPy", "model_version": "parallel-1.0"})
            return
        if route == "/api/defaults":
            self.reply(200, default_scenario())
            return
        target = (ROOT / (route.lstrip("/") or "index.html")).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            self.send_error(404)
            return
        types = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json"}
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", types.get(target.suffix, "application/octet-stream"))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if urlparse(self.path).path != "/api/simulate":
            self.send_error(404)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 32768:
                self.reply(413, {"error": "Request must be 1–32768 bytes"})
                return
            payload = json.loads(self.rfile.read(size))
            result = simulate(payload)
            self.reply(200, result)
        except (ValueError, TypeError, KeyError) as exc:
            self.reply(400, {"error": str(exc)})

    def reply(self, status, obj):
        body = json.dumps(obj, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("PARALLEL_PORT", "8000"))
    print(f"Parallel running at http://127.0.0.1:{port} (Python engine)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
