// store.js — persistenza libreria e progressi, come LibraryStore (UserDefaults)
// ma su localStorage del browser.

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
    });
  }
  save(LIB_KEY, lib);
  return idx < 0; // true se ora salvato
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
}

export function isChapterRead(mangaId, chapterId) {
  const readIds = getReadChapters(mangaId);
  return readIds.includes(chapterId);
}

