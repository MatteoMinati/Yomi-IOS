// store.js — persistenza libreria e progressi, come LibraryStore (UserDefaults)
// ma su localStorage del browser. Ogni modifica programma un push di backup
// verso il server (vedi sync.js), se la sincronizzazione è configurata.

import { schedulePush } from "./sync.js";

const LIB_KEY = "yomi.library";
const PROGRESS_KEY = "yomi.lastRead";
const READ_CHAPTERS_KEY = "yomi.readChapters";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- Libreria ------------------------------------------------------------

export function getLibrary() {
  return load(LIB_KEY, []);
}

export function isSaved(mangaId) {
  return getLibrary().some((m) => m.id === mangaId);
}

export function toggleSaved(manga) {
  const lib = getLibrary();
  const idx = lib.findIndex((m) => m.id === manga.id);
  if (idx >= 0) {
    lib.splice(idx, 1);
  } else {
    lib.unshift({
      id: manga.id,
      title: manga.title,
      coverFileName: manga.coverFileName,
      coverURL: manga.coverURL,
      addedAt: Date.now(),
    });
  }
  save(LIB_KEY, lib);
  schedulePush();
  return idx < 0; // true se ora salvato
}

// Ordinamento scelto per la Libreria (preferenza di vista, solo locale).
const LIB_SORT_KEY = "yomi.library.sort";

export function getLibrarySort() {
  return localStorage.getItem(LIB_SORT_KEY) || "recent";
}

export function setLibrarySort(key) {
  localStorage.setItem(LIB_SORT_KEY, key);
}

// --- Progressi di lettura ------------------------------------------------

export function getLastRead(mangaId) {
  const all = load(PROGRESS_KEY, {});
  return all[mangaId] ?? null;
}

export function setLastRead(mangaId, chapter, totalChapters = 0) {
  const all = load(PROGRESS_KEY, {});
  all[mangaId] = {
    chapterId: chapter.id,
    label: chapter.displayTitle,
    totalChapters: totalChapters,
    at: Date.now(),
  };
  save(PROGRESS_KEY, all);
  schedulePush();
}

// Tracciamento dei capitoli letti (per marcare cascata)

export function getReadChapters(mangaId) {
  const all = load(READ_CHAPTERS_KEY, {});
  return all[mangaId] ?? [];
}

export function markChaptersAsRead(mangaId, chapters, readChapterId) {
  // Array è inverso (più recente prima). Leggere un capitolo marca quello letto
  // e tutti i precedenti (più vecchi), cioè da lui fino alla fine dell'array.
  const startIdx = chapters.findIndex((ch) => ch.id === readChapterId);
  if (startIdx < 0) return;

  const readIds = new Set(getReadChapters(mangaId)); // preserva quelli già letti
  for (let i = startIdx; i < chapters.length; i++) {
    readIds.add(chapters[i].id);
  }

  const all = load(READ_CHAPTERS_KEY, {});
  all[mangaId] = Array.from(readIds);
  save(READ_CHAPTERS_KEY, all);
  schedulePush();
}

export function isChapterRead(mangaId, chapterId) {
  const readIds = getReadChapters(mangaId);
  return readIds.includes(chapterId);
}

// Un manga ha "nuovi capitoli" da leggere? `items` è l'elenco dei capitoli
// dal più vecchio al più recente (come lo restituisce l'API). Robusto anche sui
// dati vecchi (letti prima che salvassimo la baseline `totalChapters`).
export function hasNewChapters(mangaId, items) {
  const last = getLastRead(mangaId);
  if (!last || !items || !items.length) return false;

  // Se il capitolo letto più di recente non è l'ultimo disponibile, ci sono
  // capitoli più nuovi non letti → "nuovo". Copre anche il caso senza baseline.
  const newestId = items[items.length - 1].id;
  if (last.chapterId && last.chapterId !== newestId) return true;

  // Fallback sul conteggio (utile se il capitolo letto non è più nell'elenco).
  if (typeof last.totalChapters === "number") return items.length > last.totalChapters;
  return false;
}

