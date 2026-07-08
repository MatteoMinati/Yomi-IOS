"""
mangaworld.py — scraper MangaWorld per il backend di Yomi.

Adattato da pymangaworld (GPLv3, autore "Francesco"): stessa logica di parsing
dell'HTML, ma pensato per girare dentro server.py come sorgente dati unica.
MangaDex non restituiva risultati affidabili, quindi Yomi Web legge da MangaWorld.

Differenze rispetto all'originale:
- dominio configurabile via env MANGAWORLD_BASE (il sito cambia spesso TLD:
  .ac -> .mx -> ...), default https://www.mangaworld.mx;
- archivio ordinabile (home "Popolari"/"Aggiornati") riusando lo stesso
  selettore `div.entry` della ricerca — robusto;
- dettaglio con descrizione + generi (da og:meta e dalla info-box);
- pagine capitolo *stateless*: rileva da solo long-strip vs pagina singola,
  senza bisogno del "tipo" manga.

Richiede: requests, beautifulsoup4, lxml.
"""

import os
import re
import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional

BASE_URL = os.environ.get("MANGAWORLD_BASE", "https://www.mangaworld.mx").rstrip("/")
ARCHIVE_URL = f"{BASE_URL}/archive"

# Stati MangaWorld (italiano) -> chiavi canoniche usate dalla UI (statusLabel).
_STATUS_MAP = {
    "in corso": "ongoing",
    "finito": "completed",
    "completo": "completed",
    "in pausa": "hiatus",
    "droppato": "cancelled",
    "cancellato": "cancelled",
}


class MangaWorld:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
        })
        self._bootstrap_cookie()

    def _bootstrap_cookie(self) -> None:
        """Recupera il cookie MWCookie che alcune pagine richiedono."""
        try:
            resp = self.session.get(BASE_URL, timeout=20)
            soup = BeautifulSoup(resp.text, "lxml")
            for script in soup.find_all("script"):
                m = re.search(r"MWCookie=([^;'\"]+)", script.text or "")
                if m:
                    self.session.cookies.set("MWCookie", m.group(1))
                    break
        except Exception:
            # Il sito spesso funziona anche senza: non blocchiamo l'avvio.
            pass

    def _get(self, url: str) -> BeautifulSoup:
        resp = self.session.get(url, timeout=30)
        resp.raise_for_status()
        # Parsiamo i byte con encoding esplicito: requests a volte sbaglia la
        # detection e le accentate italiane diventano "�".
        return BeautifulSoup(resp.content, "lxml", from_encoding="utf-8")

    # --- Elenchi (ricerca / archivio) ------------------------------------

    @staticmethod
    def _parse_entries(soup: BeautifulSoup) -> List[Dict]:
        results = []
        for entry in soup.select("div.entry"):
            a = entry.find("a")
            img = entry.find("img")
            if not a or not a.get("href"):
                continue
            results.append({
                "title": (a.get("title") or a.get_text(strip=True) or "").strip(),
                "url": a["href"],
                "cover": img.get("src") if img else None,
            })
        return results

    def search(self, keyword: str) -> List[Dict]:
        soup = self._get(f"{ARCHIVE_URL}?keyword={requests.utils.quote(keyword)}")
        return self._parse_entries(soup)

    def archive(self, sort: Optional[str] = None, page: int = 1) -> List[Dict]:
        params = [f"page={page}"]
        if sort:
            params.append(f"sort={sort}")
        soup = self._get(f"{ARCHIVE_URL}?{'&'.join(params)}")
        return self._parse_entries(soup)

    # --- Dettaglio manga -------------------------------------------------

    def manga_details(self, url: str) -> Dict:
        soup = self._get(url)
        manga: Dict = {"url": url}

        # Titolo / cover / descrizione: og:meta sono i più affidabili.
        raw_title = self._text(soup.find("h1")) or self._meta(soup, "og:title") or "—"
        manga["title"] = self._clean_title(raw_title)
        manga["cover"] = self._meta(soup, "og:image")
        desc = ""
        noid = soup.find(id="noidungm")
        if noid:
            desc = noid.get_text(" ", strip=True)
        if not desc:
            desc = self._meta(soup, "og:description") or ""
        manga["description"] = desc

        # Info-box: Tipo / Stato / Anno / Generi / totali.
        info = soup.find("div", class_="info")
        tags: List[str] = []
        if info:
            for div in info.find_all("div", class_="col-12"):
                spans = div.find_all("span")
                if not spans:
                    continue
                label = spans[0].get_text(strip=True).lower().rstrip(":")
                if label == "generi":
                    tags = [a.get_text(strip=True) for a in div.find_all("a")]
                elif label == "tipo":
                    manga["type"] = self._text(div.find("a"))
                elif label == "stato":
                    manga["status"] = _STATUS_MAP.get(self._text(div.find("a")).lower())
                elif label in ("anno di uscita", "anno"):
                    manga["year"] = self._text(div.find("a"))
                elif label in ("volumi totali", "capitoli totali") and len(spans) > 1:
                    key = "total_volumes" if label.startswith("volumi") else "total_chapters"
                    manga[key] = spans[1].get_text(strip=True)
        manga["tags"] = tags
        return manga

    def chapters(self, url: str) -> List[Dict]:
        soup = self._get(url)
        chapters = []
        # Su MangaWorld i capitoli sono elencati dal più recente al più vecchio:
        # li invertiamo per avere ordine crescente (come il feed MangaDex).
        for div in reversed(soup.find_all("div", class_="chapter")):
            a = div.find("a")
            if not a or not a.get("href"):
                continue
            raw = a.get("title") or a.get_text(strip=True) or "Capitolo"
            chapters.append({"title": self._clean_chapter(raw), "url": a["href"]})
        return chapters

    # --- Pagine capitolo (stateless) -------------------------------------

    def chapter_pages(self, url: str) -> List[str]:
        # `?style=list` forza la vista a lista completa quando disponibile.
        sep = "&" if "?" in url else "?"
        soup = self._get(f"{url}{sep}style=list")
        page_div = soup.find("div", id="page")
        if not page_div:
            return []

        # Caso long-strip / manhwa: tutte le immagini sono già nel DOM.
        imgs = [i for i in page_div.select("img[src]") if i.get("id")]
        if len(imgs) > 1:
            return [i["src"] for i in imgs]

        # Caso standard: una sola immagine + <select> col numero di pagine.
        img = page_div.find("img")
        if not img or not img.get("src"):
            return []
        src = img["src"].split("?", 1)[0]
        base, _, last = src.rpartition("/")
        ext = last.rpartition(".")[2] or "png"

        total = 1
        select = soup.find("select", class_=re.compile(r"\bpage\b"))
        opt = select.find("option") if select else None
        if opt and "/" in opt.get_text():
            try:
                total = int(opt.get_text().strip().split("/")[1])
            except (ValueError, IndexError):
                total = 1
        return [f"{base}/{i + 1}.{ext}" for i in range(total)]

    # --- Helpers ---------------------------------------------------------

    @staticmethod
    def _meta(soup: BeautifulSoup, prop: str) -> Optional[str]:
        tag = soup.find("meta", attrs={"property": prop}) or soup.find(
            "meta", attrs={"name": prop}
        )
        return tag.get("content").strip() if tag and tag.get("content") else None

    @staticmethod
    def _text(node) -> str:
        return node.get_text(strip=True) if node else ""

    @staticmethod
    def _clean_title(t: str) -> str:
        t = re.sub(r"\s*-\s*MangaWorld\s*$", "", t, flags=re.I)
        t = re.sub(r"\s*Scan\s+ITA\s*$", "", t, flags=re.I)
        return t.strip() or "—"

    @staticmethod
    def _clean_chapter(t: str) -> str:
        t = re.sub(r"\s*Scan\s+ITA\s*$", "", t, flags=re.I)
        # Tieni da "Volume"/"Capitolo" in poi, scartando il nome del manga.
        m = re.search(r"(Volume|Capitolo)\b.*", t, flags=re.I)
        return (m.group(0) if m else t).strip() or "Capitolo"
