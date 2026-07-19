# Yomi 読み

A **web (PWA) manga reader** that pulls content from **MangaWorld** (Italian). No
ads, no tracking, **installable** on iPhone/Android/desktop. A small Python
backend scrapes the site and serves clean JSON to the PWA; it can optionally keep
a **backup of your data on the server**, so your library and reading progress
survive a cache wipe or a device change.

---

## What it does

- **Home** — popular and recently updated manga.
- **Search** — by title.
- **Detail** — synopsis, genres, status, year, chapter list.
- **Chapters** — sorted **newest first** (top) to oldest (bottom). Reading a
  chapter marks it read and **cascades** to all earlier ones; in the Library a
  **● Nuovo** badge flags when a new chapter dropped since your last read.
- **Reader** — two modes: **vertical** (continuous scroll) and **horizontal**
  (page by page, with left/right tap zones). A **tap on the page** hides/shows
  the bars for full-screen reading.
- **Library** — bookmark manga and keep your reading spot.
- **Backup & sync** — save library, read chapters and progress to your server;
  automatic restore on a new device. Also includes **export/import** of a
  `.json` file.
- **Installable PWA** — "Add to Home Screen" on iPhone opens it full-screen like
  an app. No build step, no npm.

---

## How it works

MangaWorld is **not an API** — it's an HTML site scraped for its data
(`web/mangaworld.py`, BeautifulSoup + lxml). That can't run in the browser, so a
**Python backend** (`web/server.py`):

- scrapes the site and serves ready-made JSON on `/api/*`;
- acts as an **image proxy** on `/img` (adds the `Referer` MangaWorld requires
  against hotlinking);
- also hosts the PWA's **static files** (single origin, no CORS);
- stores the user-state **backup** on `/api/state`.

The PWA and the backend run on the **same host**: no URL to configure.

Main endpoints:

| Endpoint | Returns |
|---|---|
| `GET /api/home` | `{popular, latest}` |
| `GET /api/search?q=…` | search results |
| `GET /api/manga?id=…` | manga detail |
| `GET /api/chapters?id=…` | chapter list |
| `GET /api/pages?id=…` | chapter page URLs |
| `GET /img?u=…` | cover/page proxy |
| `GET /api/state` | user-state backup (protected) |
| `PUT /api/state` | save the backup (protected) |

Manga and chapter `id`s are the MangaWorld URL encoded in base64url.

---

## Quick start (local, on your PC)

Requires **Python 3.13+**.

```bash
cd web
pip install -r requirements.txt
python server.py            # port 5173 (or: python server.py 8080)
```

Open **http://localhost:5173**. Stop with `Ctrl+C`.

---

## Deploy to a VPS

Keep the backend running on your server so the app works anywhere, even with your
PC off.

### 1. Start the backend

```bash
# Copy the web/ folder to the VPS, then:
cd web
pip install -r requirements.txt

# Exposed on all interfaces, on the chosen port:
HOST=0.0.0.0 python server.py 8080
```

Check: `http://YOUR-VPS-IP:8080/api/ping` should return `pong`.

### 2. HTTPS (required for the PWA on iPhone)

Put the backend behind a reverse proxy with a certificate (e.g. **Caddy**, which
handles Let's Encrypt automatically):

```
your-vps.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

and run the backend locally: `HOST=127.0.0.1 python server.py 8080`.

### 3. Persistent service (systemd)

`/etc/systemd/system/yomi.service`:

```ini
[Unit]
Description=Yomi Web backend
After=network.target

[Service]
WorkingDirectory=/opt/yomi/web
Environment=HOST=127.0.0.1
Environment=YOMI_TOKEN=put-a-passphrase-here
ExecStart=/usr/bin/python3 server.py 8080
Restart=always

[Install]
WantedBy=multi-user.target
```

Then: `sudo systemctl enable --now yomi`.

---

## Backup & sync

By default all data lives **only in the browser** (`localStorage`) and is lost if
you clear the cache or switch devices. With backup enabled, the app saves and
restores its state from the server automatically.

### 1. On the server: set a token

The backup endpoint is **protected by a shared token**. Set it with the
`YOMI_TOKEN` environment variable (in the systemd service or the environment):

```bash
YOMI_TOKEN="your-passphrase" HOST=0.0.0.0 python server.py 8080
```

> ⚠️ If `YOMI_TOKEN` is **not** set, the endpoint is **open**: anyone who reaches
> the server can read or overwrite your data. Always set it on a
> network-exposed server.

On startup the backend prints where it saves the backup and whether the token is
active.

### 2. In the app: enter the same token

Library → **⚙** (top right) → paste the same passphrase → **Salva e
sincronizza**.

From then on the backup updates itself on every change (add to library, read a
chapter…). On a new device or after a cache wipe, just re-enter the token and the
app **pulls everything on startup**. The merge is designed to not lose data when
reading from multiple devices (union of library and read chapters, most recent
progress for the last read).

The same panel has **Esporta backup** (download a `.json`) and **Importa
backup**, handy as an extra copy or for manual migration.

### Where the data lives

The backup is a JSON file **outside the web folder** (not publicly
downloadable), by default at `yomi-data/state.json` next to the `web/` folder.
You can pick another path with `YOMI_DATA`:

```bash
YOMI_DATA=/persistent/path/yomi-data python server.py 8080
```

---

## Install on iPhone

1. Open `https://your-vps.example.com/` in **Safari**.
2. **Share** → **Add to Home Screen**.
3. Yomi becomes an icon on the Home Screen and opens full-screen.
4. (Optional) Library → ⚙ → enter the token to enable backup.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| *(port)* | `5173` | First argument: `python server.py 8080` |
| `HOST` | `0.0.0.0` | Listening interface |
| `MANGAWORLD_BASE` | current domain | If MangaWorld changes TLD (`.mx`, `.ac`, …) |
| `YOMI_TOKEN` | *(empty)* | Token protecting the backup. Empty = open endpoint |
| `YOMI_DATA` | `../yomi-data` | Folder where the backup file is stored |

---

## Structure

```
web/
├── index.html            # PWA shell + tab bar + iOS meta + service worker
├── app.js                # hash router + views (Home, Search, Detail, Reader, Library, Settings)
├── api.js                # backend client (/api/* and /img)
├── config.js             # backend base (always same host)
├── store.js              # library & progress (localStorage) + backup trigger
├── sync.js               # server backup/sync + export/import
├── styles.css            # dark theme
├── manifest.webmanifest  # PWA
├── sw.js                 # service worker (app-shell cache, offline)
├── icons/                # PWA / apple-touch icons
├── server.py             # backend: static hosting + /api/* + /img + /api/state
├── mangaworld.py         # MangaWorld scraper (BeautifulSoup)
└── requirements.txt      # Python dependencies
```

Data stored in the browser (`localStorage`): `yomi.library`, `yomi.lastRead`,
`yomi.readChapters`, `yomi.reader.mode`, `yomi.sync.token`.

---

## Stack

- **Frontend:** vanilla JavaScript (ES modules), no build step.
- **Backend:** Python 3.13+ (`requests`, `beautifulsoup4`, `lxml`).
- **Storage:** browser `localStorage` + JSON backup on the server.
- **Deploy:** VPS with an HTTPS reverse proxy (e.g. Caddy).

No npm, no build, no ads, no tracking.
