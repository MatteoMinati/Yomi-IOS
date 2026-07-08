// config.js — backend Yomi è sempre lo stesso host.
//
// MangaWorld è un sito da scrapare: la PWA e il backend (server.py) girano
// nello stesso server (VPS locale o remoto). Il backend usa sempre lo stesso
// host, niente configurazione.

export function getProxyBase() {
  return ""; // "" = stesso host (location.origin)
}
