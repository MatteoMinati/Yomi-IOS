// sync.js — backup e sincronizzazione dello stato utente sul backend (VPS).
//
// Lo stato (libreria, progressi, capitoli letti, preferenze) vive nel
// localStorage del browser. Qui lo rispecchiamo su /api/state come file JSON
// sul server, così sopravvive a pulizia cache e cambio dispositivo. Il merge
// è pensato per non perdere dati quando si legge da più dispositivi.

import { getProxyBase } from "./config.js";

const TOKEN_KEY = "yomi.sync.token";

const LIB_KEY = "yomi.library";
const PROGRESS_KEY = "yomi.lastRead";
const READ_KEY = "yomi.readChapters";
const MODE_KEY = "yomi.reader.mode";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

function parse(raw, fb) {
  try {
    return raw ? JSON.parse(raw) : fb;
  } catch {
    return fb;
  }
}

// Istantanea strutturata dello stato locale (è anche il formato del backup).
export function snapshot() {
  return {
    version: 1,
    library: parse(localStorage.getItem(LIB_KEY), []),
    lastRead: parse(localStorage.getItem(PROGRESS_KEY), {}),
    readChapters: parse(localStorage.getItem(READ_KEY), {}),
    readerMode: localStorage.getItem(MODE_KEY) || null,
  };
}

// Fonde uno snapshot (remoto o importato) nello stato locale senza perdere
// dati: unione per libreria e capitoli letti, progresso più recente per
// lastRead. Ritorna true se qualcosa è effettivamente cambiato in locale.
export function applyMerged(remote) {
  if (!remote || typeof remote !== "object") return false;
  const before = JSON.stringify(snapshot());

  // Libreria: unione per id (i metadati locali prevalgono sui duplicati).
  const lib = new Map();
  for (const m of remote.library || []) if (m && m.id) lib.set(m.id, m);
  for (const m of parse(localStorage.getItem(LIB_KEY), [])) if (m && m.id) lib.set(m.id, m);
  localStorage.setItem(LIB_KEY, JSON.stringify([...lib.values()]));

  // Capitoli letti: unione degli id per ogni manga.
  const readMerged = { ...(remote.readChapters || {}) };
  const localRead = parse(localStorage.getItem(READ_KEY), {});
  for (const id in localRead) {
    readMerged[id] = [...new Set([...(readMerged[id] || []), ...localRead[id]])];
  }
  localStorage.setItem(READ_KEY, JSON.stringify(readMerged));

  // Ultima lettura: per manga tiene la voce col timestamp più recente.
  const lastMerged = { ...(remote.lastRead || {}) };
  const localLast = parse(localStorage.getItem(PROGRESS_KEY), {});
  for (const id in localLast) {
    if (!lastMerged[id] || (localLast[id].at || 0) >= (lastMerged[id].at || 0)) {
      lastMerged[id] = localLast[id];
    }
  }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(lastMerged));

  // Preferenza reader: tiene quella locale se presente, altrimenti la remota.
  if (!localStorage.getItem(MODE_KEY) && remote.readerMode) {
    localStorage.setItem(MODE_KEY, remote.readerMode);
  }

  return JSON.stringify(snapshot()) !== before;
}

function headers(extra) {
  const h = Object.assign({}, extra || {});
  const t = getToken();
  if (t) h["X-Yomi-Token"] = t;
  return h;
}

// Scarica lo stato dal server e lo fonde in locale. Ritorna true se il merge
// ha modificato qualcosa (così la UI può ri-renderizzare).
export async function pull() {
  const res = await fetch(`${getProxyBase()}/api/state`, { headers: headers() });
  if (!res.ok) throw new Error(`sync pull ${res.status}`);
  const remote = await res.json();
  return applyMerged(remote);
}

// Invia lo stato locale al server (sovrascrive il file di backup).
export async function push() {
  const res = await fetch(`${getProxyBase()}/api/state`, {
    method: "PUT",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(snapshot()),
  });
  if (!res.ok) throw new Error(`sync push ${res.status}`);
  return true;
}

// Push con debounce: chiamabile a ogni modifica senza martellare il server.
// Non fa nulla finché non è configurato un token (sync disattivato).
let timer = null;
export function schedulePush() {
  if (!getToken()) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    push().catch(() => {});
  }, 1500);
}
