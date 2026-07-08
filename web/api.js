// api.js — client MangaDex per Yomi Web.
// Le chiamate JSON passano dal proxy locale /mdx (vedi server.py).
// Le immagini vengono caricate direttamente via <img>.

const MDX = "/mdx";

const PREFERRED_LANGS = ["it", "en"];

// --- Helpers -------------------------------------------------------------

function qs(params) {
  const parts = [];
  for (const [key, val] of params) {
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
  }
  return parts.join("&");
}

async function get(path, params = []) {
  const url = params.length ? `${MDX}${path}?${qs(params)}` : `${MDX}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Errore API: ${res.status}`);
  return res.json();
}

function preferred(localized, langs = PREFERRED_LANGS) {
  if (!localized) return "—";
  for (const l of langs) {
    if (localized[l] && localized[l].trim()) return localized[l];
  }
  const first = Object.values(localized)[0];
  return first || "—";
}

// --- Normalizzazione -----------------------------------------------------

function mangaSummary(entity) {
  const attr = entity.attributes || {};
  const rels = entity.relationships || [];
  const coverRel = rels.find((r) => r.type === "cover_art");
  const coverFileName = coverRel?.attributes?.fileName ?? null;

  const tags = (attr.tags || [])
    .filter((t) => t.attributes?.group === "genre")
    .map((t) => preferred(t.attributes?.name?.values ?? t.attributes?.name));

  return {
    id: entity.id,
    title: preferred(attr.title),
    description: preferred(attr.description),
    coverFileName,
    status: attr.status ?? null,
    year: attr.year ?? null,
    tags,
    availableLanguages: attr.availableTranslatedLanguages || [],
    coverURL: coverURL(entity.id, coverFileName, 256),
    coverURLLarge: coverURL(entity.id, coverFileName, 512),
  };
}

// Le immagini passano dal proxy locale (/img) per restare same-origin.
function img(url) {
  return `/img?u=${encodeURIComponent(url)}`;
}

function coverURL(mangaId, fileName, size) {
  if (!fileName) return null;
  return img(`https://uploads.mangadex.org/covers/${mangaId}/${fileName}.${size}.jpg`);
}

function chapterSummary(entity) {
  const attr = entity.attributes || {};
  const rels = entity.relationships || [];
  const group = rels.find((r) => r.type === "scanlation_group");

  const title = attr.title || "";
  const parts = [];
  if (attr.volume) parts.push(`Vol.${attr.volume}`);
  if (attr.chapter) parts.push(`Cap.${attr.chapter}`);
  if (title) parts.push(title);

  return {
    id: entity.id,
    title,
    volume: attr.volume ?? null,
    chapter: attr.chapter ?? null,
    language: attr.translatedLanguage ?? "?",
    pages: attr.pages ?? 0,
    publishAt: attr.publishAt ?? null,
    scanlationGroup: group?.attributes?.name ?? null,
    isExternal: !!attr.externalUrl,
    displayTitle: parts.length ? parts.join(" ") : "Capitolo",
  };
}

// --- Endpoint ------------------------------------------------------------

const CONTENT_RATING = [
  ["contentRating[]", "safe"],
  ["contentRating[]", "suggestive"],
];

export async function fetchPopular(offset = 0, limit = 20) {
  const params = [
    ["limit", limit],
    ["offset", offset],
    ["order[followedCount]", "desc"],
    ...CONTENT_RATING,
    ["includes[]", "cover_art"],
    ["availableTranslatedLanguage[]", "it"],
  ];
  const resp = await get("/manga", params);
  return { items: resp.data.map(mangaSummary), total: resp.total ?? 0 };
}

export async function fetchLatestUpdated(offset = 0, limit = 20) {
  const params = [
    ["limit", limit],
    ["offset", offset],
    ["order[updatedAt]", "desc"],
    ...CONTENT_RATING,
    ["includes[]", "cover_art"],
  ];
  const resp = await get("/manga", params);
  return { items: resp.data.map(mangaSummary), total: resp.total ?? 0 };
}

export async function search(query, languages, offset = 0, limit = 20) {
  const params = [
    ["limit", limit],
    ["offset", offset],
    ["title", query],
    ...CONTENT_RATING,
    ["includes[]", "cover_art"],
  ];
  for (const lang of languages) params.push(["availableTranslatedLanguage[]", lang]);
  const resp = await get("/manga", params);
  return { items: resp.data.map(mangaSummary), total: resp.total ?? 0 };
}

export async function fetchManga(mangaId) {
  const params = [["includes[]", "cover_art"]];
  const resp = await get(`/manga/${mangaId}`, params);
  return mangaSummary(resp.data);
}

export async function fetchChapters(mangaId, languages, offset = 0, limit = 100) {
  const params = [
    ["limit", limit],
    ["offset", offset],
    ["order[volume]", "asc"],
    ["order[chapter]", "asc"],
    ["includes[]", "scanlation_group"],
  ];
  for (const lang of languages) params.push(["translatedLanguage[]", lang]);
  const resp = await get(`/manga/${mangaId}/feed`, params);
  const items = resp.data.map(chapterSummary).filter((c) => !c.isExternal);
  return { items, total: resp.total ?? 0 };
}

export async function fetchPages(chapterId, dataSaver = false) {
  const resp = await get(`/at-home/server/${chapterId}`);
  const chapter = resp.chapter;
  const filenames = dataSaver ? chapter.dataSaver : chapter.data;
  const quality = dataSaver ? "data-saver" : "data";
  return filenames.map((name) =>
    img(`${resp.baseUrl}/${quality}/${chapter.hash}/${name}`)
  );
}
