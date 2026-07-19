// app.js — router hash-based e viste di Yomi Web.

import * as api from "./api.js";
import * as store from "./store.js?v=3";
import * as sync from "./sync.js";

const app = document.getElementById("app");
const tabbar = document.getElementById("tabbar");

// --- Utility DOM ---------------------------------------------------------

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== null && v !== undefined) {
      node.setAttribute(k, v);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

function clear(n) {
  n.replaceChildren();
}

function spinner() {
  return el("div", { class: "loader" }, el("div", { class: "spin" }));
}

function errorBox(message, onRetry) {
  return el("div", { class: "errorbox" }, [
    el("p", {}, message),
    onRetry ? el("button", { class: "btn", onClick: onRetry }, "Riprova") : null,
  ]);
}

function statusLabel(s) {
  return (
    { ongoing: "In corso", completed: "Completo", hiatus: "In pausa", cancelled: "Cancellato" }[
      s
    ] || null
  );
}

// --- Card ----------------------------------------------------------------

function mangaCard(m) {
  const cover = el("div", { class: "cover" });
  if (m.coverURL) {
    cover.append(
      el("img", { src: m.coverURL, loading: "lazy", alt: m.title, onError: (e) => e.target.remove() })
    );
  } else {
    cover.append(el("div", { class: "cover-ph" }, "📖"));
  }
  return el("a", { class: "card", href: `#/manga/${m.id}` }, [
    cover,
    el("span", { class: "card-title" }, m.title),
  ]);
}

function carousel(title, items) {
  return el("section", { class: "shelf" }, [
    el("h2", {}, title),
    el("div", { class: "row" }, items.map(mangaCard)),
  ]);
}

function grid(items) {
  return el("div", { class: "grid" }, items.map(mangaCard));
}

// --- Vista: Home ---------------------------------------------------------

async function viewHome() {
  setActiveTab("home");
  clear(app);
  app.append(
    el("header", { class: "topbar spread" }, [
      el("h1", { class: "brand" }, "読み Yomi"),
    ])
  );
  const body = el("div", { class: "page" }, spinner());
  app.append(body);

  try {
    const { popular, latest } = await api.fetchHome();
    clear(body);
    body.append(
      carousel("Popolari", popular),
      carousel("Aggiornati di recente", latest)
    );
  } catch (e) {
    clear(body);
    body.append(errorBox(e.message, viewHome));
  }
}

// --- Vista: Cerca --------------------------------------------------------

const searchState = { query: "" };
let searchTimer = null;

async function viewSearch() {
  setActiveTab("search");
  clear(app);

  const input = el("input", {
    class: "search-input",
    type: "search",
    placeholder: "Cerca un manga…",
    value: searchState.query,
    onInput: (e) => {
      searchState.query = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 350);
    },
  });

  app.append(
    el("header", { class: "topbar col" }, [
      el("h1", { class: "brand small" }, "Cerca"),
      input,
    ])
  );

  const results = el("div", { class: "page" });
  app.append(results);

  async function runSearch() {
    const q = searchState.query.trim();
    if (!q) {
      clear(results);
      results.append(el("p", { class: "hint" }, "Digita per cercare tra migliaia di manga."));
      return;
    }
    clear(results);
    results.append(spinner());
    try {
      const { items } = await api.search(q);
      clear(results);
      if (!items.length) {
        results.append(el("p", { class: "hint" }, "Nessun risultato."));
      } else {
        results.append(grid(items));
      }
    } catch (e) {
      clear(results);
      results.append(errorBox(e.message, runSearch));
    }
  }

  runSearch();
  input.focus();
}

// --- Vista: Dettaglio manga ---------------------------------------------

async function viewDetail(mangaId) {
  clearActiveTab();
  clear(app);
  app.append(backBar("#/home"));
  const body = el("div", { class: "page" }, spinner());
  app.append(body);

  let manga;
  try {
    manga = await api.fetchManga(mangaId);
  } catch (e) {
    clear(body);
    body.append(errorBox(e.message, () => viewDetail(mangaId)));
    return;
  }

  const saved = store.isSaved(mangaId);
  const saveBtn = el(
    "button",
    { class: `btn save ${saved ? "on" : ""}` },
    saved ? "✓ In libreria" : "+ Aggiungi"
  );
  saveBtn.addEventListener("click", () => {
    const nowSaved = store.toggleSaved(manga);
    saveBtn.classList.toggle("on", nowSaved);
    saveBtn.textContent = nowSaved ? "✓ In libreria" : "+ Aggiungi";
  });

  const meta = [statusLabel(manga.status), manga.year].filter(Boolean).join(" · ");

  clear(body);
  body.append(
    el("div", { class: "detail-head" }, [
      el("div", { class: "cover big" }, [
        manga.coverURLLarge
          ? el("img", { src: manga.coverURLLarge, alt: manga.title })
          : el("div", { class: "cover-ph" }, "📖"),
      ]),
      el("div", { class: "detail-info" }, [
        el("h1", {}, manga.title),
        meta ? el("p", { class: "muted" }, meta) : null,
        manga.tags.length ? el("div", { class: "tags" }, manga.tags.map((t) => el("span", { class: "tag" }, t))) : null,
        saveBtn,
      ]),
    ]),
    manga.description ? el("p", { class: "desc" }, manga.description) : null
  );

  // Sezione capitoli
  const chapWrap = el("div", { class: "chapters" });

  body.append(
    el("div", { class: "chapters-head" }, [el("h2", {}, "Capitoli")]),
    chapWrap
  );

  const lastRead = store.getLastRead(mangaId);

  async function loadChapters() {
    clear(chapWrap);
    chapWrap.append(spinner());
    try {
      const { items } = await api.fetchChapters(mangaId);
      clear(chapWrap);
      if (!items.length) {
        chapWrap.append(el("p", { class: "hint" }, "Nessun capitolo disponibile."));
        return;
      }
      const reversed = items.reverse();
      const totalChapters = items.length;
      for (const ch of reversed) {
        const isRead = store.isChapterRead(mangaId, ch.id);
        chapWrap.append(
          el(
            "a",
            {
              class: `chapter ${isRead ? "read" : ""}`,
              href: `#/read/${ch.id}?manga=${mangaId}`,
              onClick: () => {
                store.setLastRead(mangaId, ch, totalChapters);
                store.markChaptersAsRead(mangaId, reversed, ch.id);
              },
            },
            [
              el("div", { class: "ch-main" }, [
                el("span", { class: "ch-title" }, ch.displayTitle),
              ]),
              isRead ? el("span", { class: "badge" }, "✓ Letto") : el("span", { class: "chev" }, "›"),
            ]
          )
        );
      }
    } catch (e) {
      clear(chapWrap);
      chapWrap.append(errorBox(e.message, loadChapters));
    }
  }

  loadChapters();
}

// --- Vista: Reader -------------------------------------------------------

const readerPrefs = {
  mode: localStorage.getItem("yomi.reader.mode") || "vertical", // vertical | horizontal
};

async function viewReader(chapterId, mangaId) {
  clearActiveTab();
  clear(app);
  document.body.classList.add("reading-mode");

  const back = mangaId ? `#/manga/${mangaId}` : "#/home";
  const counter = el("span", { class: "counter" }, "…");

  const modeBtn = el("button", { class: "icon-btn" }, readerPrefs.mode === "vertical" ? "↕" : "↔");
  modeBtn.addEventListener("click", () => {
    readerPrefs.mode = readerPrefs.mode === "vertical" ? "horizontal" : "vertical";
    localStorage.setItem("yomi.reader.mode", readerPrefs.mode);
    render();
  });

  const bar = el("header", { class: "reader-bar" }, [
    el("a", { class: "icon-btn", href: back }, "‹"),
    counter,
    el("div", { class: "reader-actions" }, [modeBtn]),
  ]);
  const stage = el("div", { class: "reader-stage" });
  app.append(bar, stage);

  // Tap sulla pagina: mostra/nasconde le barre (reader-bar in alto + tabbar in
  // basso). In orizzontale i tap-zone laterali servono a navigare, li ignoriamo.
  stage.addEventListener("click", (e) => {
    if (e.target.closest(".tap-zone")) return;
    document.body.classList.toggle("chrome-hidden");
  });

  let pages = [];

  async function load() {
    clear(stage);
    stage.append(spinner());
    try {
      pages = await api.fetchPages(chapterId);
      if (!pages.length) {
        clear(stage);
        stage.append(errorBox("Nessuna pagina disponibile."));
        return;
      }
      render();
    } catch (e) {
      clear(stage);
      stage.append(errorBox(e.message, load));
    }
  }

  function render() {
    clear(stage);
    modeBtn.textContent = readerPrefs.mode === "vertical" ? "↕" : "↔";
    if (readerPrefs.mode === "vertical") renderVertical();
    else renderHorizontal();
  }

  function renderVertical() {
    stage.className = "reader-stage vertical";
    pages.forEach((src, i) => {
      const img = el("img", {
        class: "page",
        src,
        loading: "lazy",
        "data-i": i,
        alt: `Pagina ${i + 1}`,
        // Finché non è caricata riserva spazio, così il lazy-load e il
        // contatore restano affidabili (le img a 0px si accavallerebbero).
        onLoad: (e) => e.target.classList.add("loaded"),
      });
      stage.append(img);
    });
    counter.textContent = `1 / ${pages.length}`;
    // aggiorna contatore in base allo scroll
    const imgs = [...stage.querySelectorAll("img.page")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            const i = Number(en.target.dataset.i);
            counter.textContent = `${i + 1} / ${pages.length}`;
          }
        }
      },
      { threshold: 0.5 }
    );
    imgs.forEach((im) => io.observe(im));
  }

  function renderHorizontal() {
    stage.className = "reader-stage horizontal";
    let idx = 0;
    const img = el("img", { class: "page", alt: "Pagina" });
    const zoneL = el("button", { class: "tap-zone left", "aria-label": "Precedente" });
    const zoneR = el("button", { class: "tap-zone right", "aria-label": "Successiva" });
    stage.append(zoneL, img, zoneR);

    function show(i) {
      idx = Math.max(0, Math.min(pages.length - 1, i));
      img.src = pages[idx];
      counter.textContent = `${idx + 1} / ${pages.length}`;
    }
    zoneL.addEventListener("click", () => show(idx - 1));
    zoneR.addEventListener("click", () => show(idx + 1));
    const onKey = (e) => {
      if (e.key === "ArrowRight") show(idx + 1);
      if (e.key === "ArrowLeft") show(idx - 1);
    };
    document.addEventListener("keydown", onKey);
    stage._cleanup = () => document.removeEventListener("keydown", onKey);
    show(0);
  }

  load();
}

// --- Vista: Libreria -----------------------------------------------------

function viewLibrary() {
  setActiveTab("library");
  clear(app);
  app.append(
    el("header", { class: "topbar spread" }, [
      el("h1", { class: "brand small" }, "Libreria"),
      el("a", {
        class: "icon-btn",
        href: "#/settings",
        "aria-label": "Backup e impostazioni",
        html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
      }),
    ])
  );
  const body = el("div", { class: "page" });
  app.append(body);

  const lib = store.getLibrary();
  if (!lib.length) {
    body.append(
      el("div", { class: "empty" }, [
        el("div", { class: "empty-ico" }, "📚"),
        el("p", {}, "La tua libreria è vuota."),
        el("p", { class: "muted" }, "Aggiungi manga dai loro dettagli."),
      ])
    );
    return;
  }

  // Barra di ordinamento
  const sortOptions = [
    ["recent", "Recenti"],
    ["oldest", "Meno recenti"],
    ["alpha", "A-Z"],
    ["new", "Nuovi capitoli"],
  ];
  const filterRow = el("div", { class: "filter-row" });
  const gridWrap = el("div", {});
  body.append(filterRow, gridWrap);

  // Cache dei risultati "ha nuovi capitoli?" (condivisa tra badge e ordinamento)
  const newInfo = new Map();

  async function computeNew() {
    await Promise.all(
      lib.map(async (m) => {
        if (newInfo.has(m.id)) return;
        if (!store.getLastRead(m.id)) return newInfo.set(m.id, false);
        try {
          const { items } = await api.fetchChapters(m.id);
          newInfo.set(m.id, store.hasNewChapters(m.id, items));
        } catch {
          newInfo.set(m.id, false);
        }
      })
    );
  }

  // Timestamp effettivo per l'ordine di aggiunta: le voci senza addedAt
  // (salvate prima di questa funzione) valgono come le più vecchie, ma
  // mantengono l'ordine relativo attuale (indice 0 = più recente).
  const ts = (m, i) => (typeof m.addedAt === "number" ? m.addedAt : -i);

  function sortList(key) {
    const arr = lib.map((m, i) => ({ m, i }));
    if (key === "oldest") arr.sort((a, b) => ts(a.m, a.i) - ts(b.m, b.i));
    else if (key === "alpha")
      arr.sort((a, b) => (a.m.title || "").localeCompare(b.m.title || "", "it"));
    else if (key === "new")
      arr.sort((a, b) => {
        const na = newInfo.get(a.m.id) ? 1 : 0;
        const nb = newInfo.get(b.m.id) ? 1 : 0;
        if (na !== nb) return nb - na; // con nuovi capitoli prima
        return ts(b.m, b.i) - ts(a.m, a.i);
      });
    else arr.sort((a, b) => ts(b.m, b.i) - ts(a.m, a.i)); // "recent"
    return arr.map((x) => x.m);
  }

  function renderGrid(list) {
    clear(gridWrap);
    const grid = el("div", { class: "grid" });
    gridWrap.append(grid);

    list.forEach((m) => {
      const last = store.getLastRead(m.id);
      const card = mangaCard(m);
      if (last) card.append(el("span", { class: "resume" }, last.label));

      const newBadge = el("span", { class: "new-chapters", style: "display: none;" }, "● Nuovo");
      card.querySelector(".cover").append(newBadge);
      grid.append(card);

      const showBadge = () => {
        if (newInfo.get(m.id)) newBadge.style.display = "";
      };
      if (newInfo.has(m.id)) {
        showBadge();
      } else if (last) {
        api.fetchChapters(m.id).then(({ items }) => {
          newInfo.set(m.id, store.hasNewChapters(m.id, items));
          showBadge();
        }).catch(() => {});
      }
    });
  }

  async function renderFor(key) {
    // L'ordine per "nuovi capitoli" richiede di conoscere lo stato di tutti
    // prima di disegnare: mostriamo lo spinner mentre li recuperiamo.
    if (key === "new") {
      clear(gridWrap);
      gridWrap.append(spinner());
      await computeNew();
    }
    renderGrid(sortList(key));
  }

  const activeSort = store.getLibrarySort();
  for (const [key, label] of sortOptions) {
    const chip = el(
      "button",
      {
        class: `chip ${key === activeSort ? "on" : ""}`,
        onClick: () => {
          store.setLibrarySort(key);
          for (const c of filterRow.children) c.classList.remove("on");
          chip.classList.add("on");
          renderFor(key);
        },
      },
      label
    );
    filterRow.append(chip);
  }

  renderFor(activeSort);
}

// --- Vista: Impostazioni / Backup ---------------------------------------

function viewSettings() {
  setActiveTab("library");
  clear(app);
  app.append(backBar("#/library"));
  const body = el("div", { class: "page setup" });
  app.append(body);

  const status = el("p", { class: "muted sync-status" }, "");
  function setStatus(msg, ok) {
    status.textContent = msg;
    status.style.color = ok === false ? "var(--accent)" : "var(--muted)";
  }

  const tokenInput = el("input", {
    class: "search-input",
    type: "password",
    placeholder: "Token segreto del server",
    value: sync.getToken(),
  });

  const saveBtn = el("button", { class: "btn save" }, "Salva e sincronizza");
  saveBtn.addEventListener("click", async () => {
    sync.setToken(tokenInput.value.trim());
    setStatus("Sincronizzazione…");
    try {
      await sync.pull();
      await sync.push();
      setStatus("Sincronizzato ✓");
    } catch (e) {
      setStatus("Errore: " + e.message, false);
    }
  });

  const syncNowBtn = el("button", { class: "btn" }, "Sincronizza ora");
  syncNowBtn.addEventListener("click", async () => {
    setStatus("Sincronizzazione…");
    try {
      await sync.pull();
      await sync.push();
      setStatus("Sincronizzato ✓");
    } catch (e) {
      setStatus("Errore: " + e.message, false);
    }
  });

  const exportBtn = el("button", { class: "btn" }, "Esporta backup (.json)");
  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(sync.snapshot(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = el("a", {
      href: url,
      download: `yomi-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const importInput = el("input", {
    type: "file",
    accept: "application/json",
    style: "display: none;",
  });
  const importBtn = el("button", { class: "btn" }, "Importa backup");
  importBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      sync.applyMerged(obj);
      sync.schedulePush();
      setStatus("Backup importato ✓");
    } catch (e) {
      setStatus("Import fallito: " + e.message, false);
    }
  });

  body.append(
    el("h1", {}, "Backup e sincronizzazione"),
    el("p", { class: "muted" },
      "Salva libreria e progressi sul server: restano al sicuro se pulisci la cache o cambi dispositivo."),
    el("label", { class: "setup-label" }, "Token segreto del server"),
    tokenInput,
    saveBtn,
    el("div", { class: "settings-actions" }, [syncNowBtn, exportBtn, importBtn]),
    importInput,
    status
  );
}

// --- Componenti condivisi ------------------------------------------------

function backBar(fallback) {
  return el("header", { class: "topbar back" }, [
    el(
      "a",
      {
        class: "icon-btn",
        href: fallback,
        onClick: (e) => {
          if (history.length > 1) {
            e.preventDefault();
            history.back();
          }
        },
      },
      "‹"
    ),
  ]);
}

function setActiveTab(tab) {
  document.body.classList.remove("reading-mode", "chrome-hidden");
  tabbar.style.display = "";
  for (const a of tabbar.querySelectorAll("a")) {
    a.classList.toggle("active", a.dataset.tab === tab);
  }
}

function clearActiveTab() {
  document.body.classList.remove("reading-mode", "chrome-hidden");
  tabbar.style.display = "";
  for (const a of tabbar.querySelectorAll("a")) a.classList.remove("active");
}


// --- Router --------------------------------------------------------------

function parseRoute() {
  const hash = location.hash.slice(1) || "/home";
  const [path, query] = hash.split("?");
  const params = new URLSearchParams(query || "");
  const parts = path.split("/").filter(Boolean); // es. ["manga", "id"]
  return { parts, params };
}

async function router() {
  // pulizia eventuali listener del reader precedente
  const oldStage = app.querySelector(".reader-stage");
  if (oldStage && oldStage._cleanup) oldStage._cleanup();

  const { parts, params } = parseRoute();
  const [root, arg] = parts;

  switch (root) {
    case "home":
    case undefined:
      return viewHome();
    case "search":
      return viewSearch();
    case "library":
      return viewLibrary();
    case "manga":
      return viewDetail(arg);
    case "read":
      return viewReader(arg, params.get("manga"));
    case "settings":
      return viewSettings();
    default:
      location.hash = "#/home";
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", () => {
  router();
  window.scrollTo(0, 0);
});

function boot() {
  router();
  // Sincronizzazione iniziale in background (solo se il token è configurato):
  // scarica il backup dal server, lo fonde in locale e, se qualcosa è
  // cambiato, ri-renderizza; poi ricarica sul server lo stato unito.
  if (sync.getToken()) {
    sync
      .pull()
      .then((changed) => {
        if (changed) router();
        sync.schedulePush();
      })
      .catch(() => {});
  }
}

window.addEventListener("DOMContentLoaded", boot);
if (document.readyState !== "loading") boot();
