#!/usr/bin/env python3
"""
Yomi Web — backend + hosting statico (da ospitare sul tuo VPS).

A differenza della versione precedente (semplice proxy CORS verso MangaDex),
questo è un vero backend: MangaWorld non è un'API JSON ma un sito da scrapare
(vedi mangaworld.py), quindi la logica gira qui e la PWA riceve JSON già pronto.

Espone:
    GET /                       -> file statici della PWA (index.html, js, css…)
    GET /api/ping               -> "pong"                (usato dal setup)
    GET /api/home               -> {popular:[…], latest:[…]}
    GET /api/search?q=…         -> {items:[…]}
    GET /api/manga?id=<b64url>  -> dettaglio manga
    GET /api/chapters?id=<…>    -> {items:[…]}
    GET /api/pages?id=<…>       -> {pages:[url,…]}
    GET /img?u=<url>            -> proxy immagini (cover + pagine), con Referer

Gli id manga/capitolo sono l'URL MangaWorld codificato in base64url.

Uso:
    pip install -r requirements.txt
    python server.py            # porta 5173
    python server.py 8080       # porta a scelta
    HOST=0.0.0.0 python server.py 8080   # esposto sul VPS

Dominio MangaWorld configurabile: MANGAWORLD_BASE=https://www.mangaworld.xx
"""

import os
import sys
import json
import hmac
import base64
import urllib.parse
import urllib.request
import urllib.error
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from mangaworld import MangaWorld, BASE_URL

WEB_DIR = os.path.dirname(os.path.abspath(__file__))

# Backup dello stato utente (libreria, progressi, capitoli letti). Il file sta
# FUORI dalla WEB_DIR così non è scaricabile pubblicamente come file statico.
# Percorso e segreto configurabili via variabili d'ambiente.
DATA_DIR = os.environ.get("YOMI_DATA", os.path.join(os.path.dirname(WEB_DIR), "yomi-data"))
STATE_FILE = os.path.join(DATA_DIR, "state.json")
# Token condiviso per proteggere gli endpoint di backup. Se vuoto: accesso
# libero (sconsigliato su un server esposto in rete).
YOMI_TOKEN = os.environ.get("YOMI_TOKEN", "")
_state_lock = threading.Lock()

# Host consentiti per il proxy immagini: tutto ciò che sta sotto il dominio
# di MangaWorld (www.* e cdn.*), qualunque sia il TLD corrente.
_ROOT_DOMAIN = urllib.parse.urlparse(BASE_URL).hostname or ""
if _ROOT_DOMAIN.startswith("www."):
    _ROOT_DOMAIN = _ROOT_DOMAIN[4:]

# Istanza scraper condivisa. Un lock serializza le richieste: uso personale,
# nessun bisogno di parallelismo aggressivo e la Session resta consistente.
_mw = MangaWorld()
_mw_lock = threading.Lock()


def _encode_id(url: str) -> str:
    return base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")


def _decode_id(token: str) -> str:
    pad = "=" * (-len(token) % 4)
    url = base64.urlsafe_b64decode(token + pad).decode()
    # SSRF guard: accettiamo solo URL del dominio MangaWorld.
    host = urllib.parse.urlparse(url).hostname or ""
    if not (host == _ROOT_DOMAIN or host.endswith("." + _ROOT_DOMAIN)):
        raise ValueError("host non consentito")
    return url


def _summary(entry: dict) -> dict:
    """Entry {title,url,cover} -> oggetto con id codificato per la PWA."""
    return {
        "id": _encode_id(entry["url"]),
        "title": entry.get("title") or "—",
        "cover": entry.get("cover"),
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, fmt, *args):
        pass  # silenzioso; gli errori applicativi tornano come JSON

    def end_headers(self):
        # File statici dell'app shell: no-cache così il browser rivalida sempre
        # (304 se invariato) invece di servire moduli JS/CSS stantii dalla cache
        # euristica. API e immagini gestiscono i propri header di cache.
        path = urllib.parse.urlparse(self.path).path
        if not path.startswith("/api/") and path != "/img":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/img":
            return self._proxy_image()
        if path.startswith("/api/"):
            return self._api(path)
        return super().do_GET()

    def do_PUT(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/state":
            return self._put_state()
        self._json({"error": "endpoint sconosciuto"}, status=404)

    # --- API -------------------------------------------------------------

    def _api(self, path: str):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)

        def arg(name, default=""):
            return params.get(name, [default])[0]

        try:
            if path == "/api/ping":
                return self._text("pong")

            if path == "/api/state":
                return self._get_state()

            if path == "/api/home":
                with _mw_lock:
                    popular = _mw.archive(sort="most_read")
                    latest = _mw.archive(sort="newest")
                return self._json({
                    "popular": [_summary(e) for e in popular],
                    "latest": [_summary(e) for e in latest],
                })

            if path == "/api/search":
                q = arg("q").strip()
                items = []
                if q:
                    with _mw_lock:
                        items = _mw.search(q)
                return self._json({"items": [_summary(e) for e in items]})

            if path == "/api/manga":
                url = _decode_id(arg("id"))
                with _mw_lock:
                    m = _mw.manga_details(url)
                return self._json({
                    "id": _encode_id(url),
                    "title": m.get("title") or "—",
                    "cover": m.get("cover"),
                    "description": m.get("description") or "",
                    "status": m.get("status"),
                    "year": m.get("year"),
                    "type": m.get("type"),
                    "tags": m.get("tags") or [],
                })

            if path == "/api/chapters":
                url = _decode_id(arg("id"))
                with _mw_lock:
                    chs = _mw.chapters(url)
                return self._json({
                    "items": [
                        {"id": _encode_id(c["url"]), "title": c["title"]} for c in chs
                    ]
                })

            if path == "/api/pages":
                url = _decode_id(arg("id"))
                with _mw_lock:
                    pages = _mw.chapter_pages(url)
                return self._json({"pages": pages})

            self._json({"error": "endpoint sconosciuto"}, status=404)
        except ValueError as e:
            self._json({"error": f"richiesta non valida: {e}"}, status=400)
        except Exception as e:  # noqa: BLE001
            self._json({"error": str(e)}, status=502)

    # --- Backup / sync stato utente --------------------------------------

    def _authorized(self) -> bool:
        # Se non è configurato alcun token, accesso libero (personale).
        if not YOMI_TOKEN:
            return True
        sent = self.headers.get("X-Yomi-Token", "")
        if not sent:
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            sent = q.get("token", [""])[0]
        return hmac.compare_digest(sent, YOMI_TOKEN)

    def _get_state(self):
        if not self._authorized():
            return self._json({"error": "non autorizzato"}, status=401)
        with _state_lock:
            try:
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except FileNotFoundError:
                data = {}
            except Exception as e:  # noqa: BLE001
                return self._json({"error": str(e)}, status=500)
        return self._json(data)

    def _put_state(self):
        if not self._authorized():
            return self._json({"error": "non autorizzato"}, status=401)
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0 or length > 5_000_000:  # guardia: corpo mancante/eccessivo
            return self._json({"error": "corpo mancante o troppo grande"}, status=400)
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception:  # noqa: BLE001
            return self._json({"error": "JSON non valido"}, status=400)
        if not isinstance(data, dict):
            return self._json({"error": "atteso un oggetto JSON"}, status=400)
        with _state_lock:
            os.makedirs(DATA_DIR, exist_ok=True)
            tmp = STATE_FILE + ".tmp"
            try:
                # Scrittura atomica: prima su file temporaneo, poi rename.
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False)
                os.replace(tmp, STATE_FILE)
            except Exception as e:  # noqa: BLE001
                return self._json({"error": str(e)}, status=500)
        return self._json({"ok": True})

    # --- Proxy immagini --------------------------------------------------

    def _proxy_image(self):
        query = urllib.parse.urlparse(self.path).query
        target = urllib.parse.parse_qs(query).get("u", [""])[0]
        host = urllib.parse.urlparse(target).hostname or ""
        ok = target.startswith("https://") and (
            host == _ROOT_DOMAIN or host.endswith("." + _ROOT_DOMAIN)
        )
        if not ok:
            return self._json({"error": "URL immagine non consentito"}, status=400)

        req = urllib.request.Request(target, headers={
            "User-Agent": "Mozilla/5.0 (Yomi Web Reader)",
            # MangaWorld blocca l'hotlinking senza Referer del proprio dominio.
            "Referer": BASE_URL + "/",
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read()
                status = resp.status
                ctype = resp.headers.get("Content-Type", "image/jpeg")
        except urllib.error.HTTPError as e:
            body, status, ctype = e.read(), e.code, "text/plain"
        except Exception as e:  # noqa: BLE001
            return self._json({"error": str(e)}, status=502)

        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        self.wfile.write(body)

    # --- Risposte --------------------------------------------------------

    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _text(self, s, status=200):
        body = s.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    host = os.environ.get("HOST", "0.0.0.0")
    server = ThreadingHTTPServer((host, port), Handler)
    shown = "localhost" if host in ("127.0.0.1", "0.0.0.0") else host
    print(f"Yomi Web attivo su  http://{shown}:{port}")
    print(f"Sorgente dati: {BASE_URL}")
    print(f"Backup stato:  {STATE_FILE}")
    print(f"Protezione:    {'token attivo' if YOMI_TOKEN else 'NESSUN token (imposta YOMI_TOKEN)'}")
    print("Premi Ctrl+C per fermare.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nChiuso.")
        server.shutdown()


if __name__ == "__main__":
    main()
