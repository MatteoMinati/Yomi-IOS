#!/usr/bin/env python3
"""
Yomi Web — server locale a zero dipendenze.

- Serve i file statici della web app (index.html, css, js).
- Fa da proxy CORS per le sole chiamate JSON verso l'API MangaDex,
  su percorsi /mdx/*  ->  https://api.mangadex.org/*
  (necessario perche' le risposte cache di MangaDex a volte non
   includono l'header Access-Control-Allow-Origin).

Le immagini (copertine e pagine) NON passano da qui: vengono caricate
direttamente dal browser via <img>, che non richiede CORS.

Uso:
    python server.py            # porta 5173
    python server.py 8080       # porta a scelta
Poi apri http://localhost:5173
"""

import sys
import os
import urllib.request
import urllib.error
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

MDX_API = "https://api.mangadex.org"
WEB_DIR = os.path.dirname(os.path.abspath(__file__))

# Host consentiti per il proxy immagini (copertine + pagine).
ALLOWED_IMG_SUFFIXES = (".mangadex.org", ".mangadex.network")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    # Silenzia i log rumorosi ma tiene gli errori
    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        if self.path.startswith("/mdx/"):
            self._proxy_api()
        elif self.path.startswith("/img?"):
            self._proxy_image()
        else:
            super().do_GET()

    def _proxy_api(self):
        target = MDX_API + self.path[len("/mdx"):]
        self._forward(target, default_ctype="application/json", cache="no-store")

    def _proxy_image(self):
        query = urllib.parse.urlparse(self.path).query
        target = urllib.parse.parse_qs(query).get("u", [""])[0]
        host = urllib.parse.urlparse(target).hostname or ""
        if not (target.startswith("https://") and host.endswith(ALLOWED_IMG_SUFFIXES)):
            self.send_error(400, "URL immagine non consentito")
            return
        # Le immagini sono immutabili: cache aggressiva lato browser.
        self._forward(target, default_ctype="image/jpeg", cache="public, max-age=86400")

    def _forward(self, target, default_ctype, cache):
        req = urllib.request.Request(
            target,
            headers={"User-Agent": "Yomi/1.0 (Web Reader)"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read()
                status = resp.status
                ctype = resp.headers.get("Content-Type", default_ctype)
        except urllib.error.HTTPError as e:
            body = e.read()
            status = e.code
            ctype = e.headers.get("Content-Type", default_ctype)
        except Exception as e:  # noqa: BLE001
            body = ('{"result":"error","errors":[{"detail":%r}]}' % str(e)).encode()
            status = 502
            ctype = "application/json"

        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://localhost:{port}"
    print(f"Yomi Web attivo su  {url}")
    print("Premi Ctrl+C per fermare.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nChiuso.")
        server.shutdown()


if __name__ == "__main__":
    main()
