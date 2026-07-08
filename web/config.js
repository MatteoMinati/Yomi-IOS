// config.js — dove trovare il backend Yomi (server.py).
//
// MangaWorld è un sito da scrapare, non un'API: la PWA parla con un backend
// Python (server.py) che fa il lavoro. In locale (localhost) il backend è sullo
// stesso indirizzo; online è il tuo VPS, il cui URL si salva una volta nel
// browser.

const KEY = "yomi.proxyBase";

function isLocalHost() {
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

// Ritorna il prefisso per /mdx e /img, oppure null se non ancora configurato.
export function getProxyBase() {
  const saved = localStorage.getItem(KEY);
  if (saved) return saved.replace(/\/+$/, "");
  if (isLocalHost()) return ""; // stesso host: server.py serve /mdx e /img
  return null; // online senza proxy impostato
}

export function isConfigured() {
  return getProxyBase() !== null;
}

export function setProxyBase(url) {
  const clean = String(url || "").trim().replace(/\/+$/, "");
  if (!clean) return false;
  localStorage.setItem(KEY, clean);
  return true;
}

export function clearProxyBase() {
  localStorage.removeItem(KEY);
}
