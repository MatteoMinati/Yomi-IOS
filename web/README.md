# Yomi Web

Versione web di **Yomi**, il lettore di manga basato sull'API pubblica di MangaDex.
Stesse funzioni dell'app iOS (Home, Ricerca IT/EN, Dettaglio, Reader, Libreria),
ma nel browser. **Zero dipendenze**: serve solo Python 3 (già incluso in molti sistemi).

## Avvio

Dalla cartella del progetto:

```bash
python web/server.py
```

Poi apri **http://localhost:5173** nel browser.

Per usare un'altra porta:

```bash
python web/server.py 8080
```

Ferma il server con `Ctrl+C`.

## Come funziona

`server.py` è un piccolo server locale a zero dipendenze (solo libreria standard Python) che:

1. **serve i file statici** della web app (`index.html`, `styles.css`, `*.js`);
2. fa da **proxy CORS** verso l'API MangaDex sui percorsi `/mdx/*`
   (necessario perché le risposte in cache di MangaDex a volte non
   includono l'header `Access-Control-Allow-Origin`, bloccando le
   chiamate dirette dal browser);
3. fa da **proxy immagini** su `/img?u=...` per copertine e pagine, così
   tutta l'app è same-origin e non dipende da CORS o certificati esterni.
   Sono ammessi solo host `*.mangadex.org` e `*.mangadex.network`.

Le preferenze (libreria, capitolo letto, modalità reader, data saver) sono
salvate nel `localStorage` del browser.

## Struttura

```
web/
  server.py     # server statico + proxy (zero dipendenze)
  index.html    # shell + tab bar
  styles.css    # tema scuro
  api.js        # client MangaDex (via proxy /mdx e /img)
  store.js      # libreria e progressi (localStorage)
  app.js        # router hash-based + viste
```

## Uso su rete locale (es. dal telefono)

Il server ascolta solo su `127.0.0.1`. Per raggiungerlo da un altro
dispositivo sulla stessa rete, modifica in `server.py` l'indirizzo di bind
da `"127.0.0.1"` a `"0.0.0.0"` e apri `http://<ip-del-pc>:5173`.
