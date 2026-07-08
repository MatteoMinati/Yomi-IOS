// api.js — client del backend Yomi (MangaWorld).
//
// Il backend (server.py, sul tuo VPS) fa lo scraping di MangaWorld ed espone
// JSON già pronto su /api/*; le immagini passano da /img. Qui normalizziamo le
// risposte nelle stesse forme che app.js già si aspetta (mangaSummary /
// chapterSummary), così le viste non sono cambiate.

import { getProxyBase } from "./config.js";

export class ProxyNotConfigured extends Error {
  constructor() {
    super("Backend non configurato");
    this.name = "ProxyNotConfigured";
  }
}

function base() {
  const b = getProxyBase();
  if (b === null) throw new ProxyNotConfigured();
  return b;
}

// --- Helpers -------------------------------------------------------------

async function get(path) {
  const res = await fetch(`${base()}${path}`);
  if (!res.ok) {
    let detail = `Errore ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.error) detail = j.error;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

// Le immagini (cover + pagine) passano dallo stesso backend, che aggiunge il
// Referer richiesto da MangaWorld contro l'hotlinking.
function img(url) {
  return url ? `${base()}/img?u=${encodeURIComponent(url)}` : null;
}

// --- Normalizzazione -----------------------------------------------------

function mangaSummary(o) {
  const cover = img(o.cover);
  return {
    id: o.id,
    title: o.title || "—",
    description: o.description || "",
    status: o.status ?? null,
    year: o.year ?? null,
    type: o.type ?? null,
    tags: o.tags || [],
    coverFileName: o.cover || null, // usato solo come chiave in libreria
    coverURL: cover,
    coverURLLarge: cover, // MangaWorld ha una sola copertina
  };
}

function chapterSummary(o) {
  return {
    id: o.id,
    displayTitle: o.title || "Capitolo",
  };
}

// --- Endpoint ------------------------------------------------------------

export async function fetchHome() {
  const resp = await get("/api/home");
  return {
    popular: (resp.popular || []).map(mangaSummary),
    latest: (resp.latest || []).map(mangaSummary),
  };
}

export async function search(query) {
  const resp = await get(`/api/search?q=${encodeURIComponent(query)}`);
  return { items: (resp.items || []).map(mangaSummary) };
}

export async function fetchManga(mangaId) {
  const resp = await get(`/api/manga?id=${encodeURIComponent(mangaId)}`);
  return mangaSummary(resp);
}

export async function fetchChapters(mangaId) {
  const resp = await get(`/api/chapters?id=${encodeURIComponent(mangaId)}`);
  return { items: (resp.items || []).map(chapterSummary) };
}

export async function fetchPages(chapterId) {
  const resp = await get(`/api/pages?id=${encodeURIComponent(chapterId)}`);
  return (resp.pages || []).map(img);
}
