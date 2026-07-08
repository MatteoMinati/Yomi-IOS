# Yomi 読み

Manga reader web app (PWA) powered by MangaWorld. No ads, no tracking, installable on iPhone.

## Features

- Browse popular and recently updated manga
- Search by title
- Chapter list per manga
- Reader with horizontal (page-by-page) and vertical (continuous scroll) modes
- Library to bookmark manga and track reading progress
- Installable as PWA on iPhone/Android/desktop

## Quick Start

**Local development (PC):**

```bash
cd web
pip install -r requirements.txt
python server.py
```

Open **http://localhost:5173**. Changes to `web/` files auto-reload in the browser.

**Deploy to your VPS:**

See [web/DEPLOY.md](web/DEPLOY.md) — the Python backend (`server.py`) needs to run on your VPS so the PWA can fetch data from MangaWorld.

## Architecture

```
web/
├── index.html                # PWA shell + meta tags
├── app.js                    # hash router + views (Home, Search, Detail, Reader, Library)
├── api.js                    # client for backend /api/* endpoints
├── config.js                 # backend URL resolution (localhost vs VPS)
├── store.js                  # library & progress (localStorage)
├── styles.css                # dark theme
├── manifest.webmanifest      # PWA metadata
├── sw.js                     # service worker (app shell cache, offline)
├── icons/                    # PWA icons
├── server.py                 # backend: static file hosting + /api/* + /img proxy
├── mangaworld.py             # MangaWorld HTML scraper (BeautifulSoup)
└── requirements.txt          # Python deps (beautifulsoup4, lxml, requests)
```

**Why a backend?** MangaWorld is not an API — it's an HTML site. Scraping requires Python + BeautifulSoup, which can't run in the browser. `server.py` does the scraping and exposes clean JSON to the PWA.

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES modules), no build step
- **Backend:** Python 3.12+ (requests, beautifulsoup4, lxml)
- **Storage:** localStorage (browser) + file hosting (server)
- **Deployment:** VPS (you bring your own; Caddy for HTTPS)

No npm, no build tools, no ads, no tracking.
