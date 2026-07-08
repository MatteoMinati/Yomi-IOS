# Yomi Web — Guida al deploy (PWA su iPhone)

Obiettivo: usare Yomi come **app installata sull'iPhone**, senza tenere il PC acceso.

A differenza di prima, i dati arrivano da **MangaWorld** tramite scraping: serve
un **backend Python** (`server.py`), che va ospitato sul tuo **VPS**. Un
Cloudflare Worker **non** basta più (non può eseguire lo scraper Python).

Servono due pezzi:

1. **Il backend** — `server.py` + `mangaworld.py`, in esecuzione sul VPS.
2. **La PWA** — i file statici in `web/`. Il modo più semplice è farli servire
   **dallo stesso `server.py`** (già lo fa): un solo indirizzo, niente problemi
   di CORS o di URL da configurare.

---

## Parte 1 — Backend sul VPS

Sul VPS (serve Python 3.12+):

```bash
# 1. Copia la cartella web/ sul VPS, poi:
cd web
pip install -r requirements.txt

# 2. Avvia il backend, esposto su tutte le interfacce:
HOST=0.0.0.0 python server.py 8080
```

Verifica da un browser: `http://IP-DEL-VPS:8080/api/ping` deve rispondere `pong`,
e `http://IP-DEL-VPS:8080/` deve mostrare Yomi.

### Metterlo in produzione (consigliato)

- **HTTPS**: la PWA su iPhone richiede `https://`. Metti il backend dietro un
  reverse proxy (Nginx/Caddy) con un certificato (Let's Encrypt). Esempio Caddy:

  ```
  tuo-vps.example.com {
      reverse_proxy 127.0.0.1:8080
  }
  ```
  e avvia `server.py` in locale (`HOST=127.0.0.1 python server.py 8080`).

- **Servizio persistente**: tienilo attivo con `systemd`. Esempio
  `/etc/systemd/system/yomi.service`:

  ```ini
  [Unit]
  Description=Yomi Web backend
  After=network.target

  [Service]
  WorkingDirectory=/opt/yomi/web
  Environment=HOST=127.0.0.1
  ExecStart=/usr/bin/python3 server.py 8080
  Restart=always

  [Install]
  WantedBy=multi-user.target
  ```
  Poi: `sudo systemctl enable --now yomi`.

> Se MangaWorld cambia dominio, imposta la variabile
> `MANGAWORLD_BASE=https://www.mangaworld.NUOVO` (nel service o nell'ambiente).

---

## Parte 2 — La PWA

**Opzione A (più semplice):** servi la PWA dallo stesso backend. Apri
`https://tuo-vps.example.com/` — è già Yomi. Su `localhost`/stesso host non serve
alcuna configurazione.

**Opzione B:** ospita i file statici altrove (GitHub Pages, Netlify, Cloudflare
Pages…) e punta al backend del VPS. In questo caso, al primo avvio l'app chiede
l'**URL del backend**: incolla `https://tuo-vps.example.com`.

---

## Parte 3 — Installazione su iPhone

1. Apri l'URL in **Safari** sull'iPhone.
2. Se richiesto, in **"Configura il backend"** incolla `https://tuo-vps.example.com`
   e premi **Salva e verifica** (deve rispondere `pong`).
3. Premi **Condividi** → **Aggiungi alla schermata Home**.
4. Ora Yomi è un'icona sulla Home e si apre a schermo intero come un'app.

L'URL del backend resta salvato nel browser; per cambiarlo, usa l'ingranaggio ⚙
in alto nella Home.

---

## Sviluppo in locale (sul PC)

```bash
pip install -r web/requirements.txt
python web/server.py
```

Apri **http://localhost:5173**. Su `localhost` l'app usa automaticamente il
backend locale, quindi non chiede alcuna configurazione.
