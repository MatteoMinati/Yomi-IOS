/* Service worker di Yomi: mette in cache l'app shell per l'avvio offline e
   l'installazione come app. I dati (backend MangaWorld e immagini) restano
   sulla rete: nessun intervento sulle richieste cross-origin. */
const CACHE = 'yomi-v6';

const SHELL = [
  './',
  './index.html',
  './styles.css?v=2',
  './api.js',
  './store.js?v=3',
  './sync.js',
  './config.js',
  './app.js?v=2',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {}) // se un file manca non blocca l'installazione
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Solo asset dell'app (stesso dominio): network-first con la cache come
  // riserva offline. Così online si vede sempre la versione aggiornata.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
  }
  // Richieste al proxy (API, immagini): lasciate alla rete.
});
