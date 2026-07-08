# Yomi Web

Versione web di **Yomi**, il lettore di manga. Legge i contenuti da
**MangaWorld** (in italiano) tramite un piccolo backend Python. Stesse funzioni
dell'app iOS (Home, Ricerca, Dettaglio, Reader, Libreria), ma nel browser — ed è
una **PWA installabile** su iPhone (Aggiungi a Home).

## Provarla in locale (sul PC)

`server.py` fa sia da hosting statico sia da backend.

```bash
pip install -r web/requirements.txt
python web/server.py        # porta 5173 (o passa un'altra porta: python web/server.py 8080)
```

Apri **http://localhost:5173**. Su `localhost` l'app usa automaticamente il
backend locale, senza chiedere configurazione. Ferma con `Ctrl+C`.

## Usarla come app sull'iPhone

Vedi **[DEPLOY.md](DEPLOY.md)**: si ospita `server.py` sul proprio **VPS** e si
pubblica la PWA (o la si serve dallo stesso VPS). Al primo avvio l'app chiede
l'URL del backend, poi funziona ovunque, anche a PC spento.

## Come funziona

MangaWorld **non è un'API**: è un sito da cui si estraggono i dati facendo lo
scraping dell'HTML (`mangaworld.py`, adattato da
[pymangaworld](https://github.com/) — GPLv3). Questo lavoro richiede Python
(BeautifulSoup + lxml), quindi gira in un **backend** — non più un semplice
proxy, e **non** su Cloudflare Workers.

`server.py` espone JSON già pronto e un proxy immagini:

- `/api/ping` → `pong` (usato dalla schermata di configurazione);
- `/api/home` → `{popular, latest}` (archivio ordinato per più letti / più recenti);
- `/api/search?q=…` → risultati di ricerca;
- `/api/manga?id=…` → dettaglio (trama, generi, stato, anno);
- `/api/chapters?id=…` → elenco capitoli;
- `/api/pages?id=…` → URL delle pagine del capitolo;
- `/img?u=…` → proxy per copertine e pagine (aggiunge il `Referer` che
  MangaWorld richiede contro l'hotlinking; consente solo host del suo dominio).

Gli `id` di manga e capitoli sono l'URL MangaWorld codificato in base64url.

`config.js` decide dove trovare il backend: su `localhost` è lo stesso indirizzo;
online è l'URL del VPS salvato dall'utente (schermata di configurazione / ⚙).

Il dominio di MangaWorld cambia spesso TLD (`.ac` → `.mx` → …): è configurabile
senza toccare il codice con la variabile d'ambiente `MANGAWORLD_BASE`.

Le preferenze (libreria, capitolo letto, modalità reader, URL del backend) sono
salvate nel `localStorage` del browser.

## Struttura

```
web/
  index.html            # shell + tab bar + PWA (manifest, meta iOS, service worker)
  styles.css            # tema scuro
  config.js             # dove trovare il backend (locale vs VPS)
  api.js                # client del backend (/api/* e /img)
  store.js              # libreria e progressi (localStorage)
  app.js                # router hash-based + viste (incl. setup backend)
  manifest.webmanifest  # PWA
  sw.js                 # service worker (cache app shell, offline)
  icons/                # icone PWA / apple-touch-icon
  server.py             # backend + hosting (da ospitare sul VPS)
  mangaworld.py         # scraper MangaWorld usato da server.py
  requirements.txt      # dipendenze Python del backend
```

## Deploy come app su iPhone

Vedi **[DEPLOY.md](DEPLOY.md)**.
