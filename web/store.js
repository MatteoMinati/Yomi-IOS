// store.js — persistenza libreria e progressi, come LibraryStore (UserDefaults)
// ma su localStorage del browser.

const LIB_KEY = "yomi.library";
const PROGRESS_KEY = "yomi.lastRead";

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

export function setLastRead(mangaId, chapter) {
  const all = load(PROGRESS_KEY, {});
  all[mangaId] = {
    chapterId: chapter.id,
    label: chapter.displayTitle,
    at: Date.now(),
  };
  save(PROGRESS_KEY, all);
}
