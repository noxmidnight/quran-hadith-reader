import {
  loadArabicQuran,
  loadHadithBook,
  loadHadithIndex,
  loadTafsir,
  loadTafsirsIndex,
  loadTranslation,
  loadTranslationsIndex,
} from "./data";
import { createCopyPanel } from "./copy";
import { debounce, filterCards, filterNavByText } from "./search";
import type {
  ArabicQuran,
  CardItem,
  HadithBook,
  HadithBookMeta,
  Mode,
  NavItem,
  TafsirMeta,
  TranslationMeta,
} from "./types";
import { createVirtualList } from "./virtual-list";

const DEFAULT_TRANSLATION = "en.sahih";
const DEFAULT_TAFSIR = "en-al-jalalayn";
const LS_TRANSLATION = "qhr.translation";
const LS_TAFSIR = "qhr.tafsir";

type QuranView = "surahs" | "ayahs";
type HadithView = "collections" | "chapters" | "hadiths";

const statusEl = document.querySelector<HTMLElement>("#status")!;
const searchInput = document.querySelector<HTMLInputElement>("#search-input")!;
const translationBtn = document.querySelector<HTMLButtonElement>("#translation-btn")!;
const translationName = document.querySelector<HTMLElement>("#translation-name")!;
const tafsirBtn = document.querySelector<HTMLButtonElement>("#tafsir-btn")!;
const tafsirName = document.querySelector<HTMLElement>("#tafsir-name")!;
const navBar = document.querySelector<HTMLElement>("#nav-bar")!;
const backBtn = document.querySelector<HTMLButtonElement>("#back-btn")!;
const navPath = document.querySelector<HTMLElement>("#nav-path")!;

const transOverlay = document.querySelector<HTMLElement>("#trans-overlay")!;
const transClose = document.querySelector<HTMLButtonElement>("#trans-close")!;
const transSearch = document.querySelector<HTMLInputElement>("#trans-search")!;
const transList = document.querySelector<HTMLElement>("#trans-list")!;

const tafsirOverlay = document.querySelector<HTMLElement>("#tafsir-overlay")!;
const tafsirClose = document.querySelector<HTMLButtonElement>("#tafsir-close")!;
const tafsirSearch = document.querySelector<HTMLInputElement>("#tafsir-search")!;
const tafsirList = document.querySelector<HTMLElement>("#tafsir-list")!;

const toastEl = document.querySelector<HTMLElement>("#toast")!;
const viewport = document.querySelector<HTMLElement>("#list-viewport")!;
const spacer = document.querySelector<HTMLElement>("#list-spacer")!;
const windowEl = document.querySelector<HTMLElement>("#list-window")!;

let mode: Mode = "quran";
let quranView: QuranView = "surahs";
let hadithView: HadithView = "collections";

let translations: TranslationMeta[] = [];
let tafsirs: TafsirMeta[] = [];
let books: HadithBookMeta[] = [];
let activeTranslationId =
  localStorage.getItem(LS_TRANSLATION) || DEFAULT_TRANSLATION;
let activeTafsirId = localStorage.getItem(LS_TAFSIR) || DEFAULT_TAFSIR;

let arabicCache: ArabicQuran | null = null;
let translationTexts: string[] = [];
let tafsirTexts: string[] = [];
let activeSurah: number | null = null;

let activeBook: HadithBook | null = null;
let activeHadithChapterId: number | null = null;

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function setStatus(msg: string) {
  statusEl.textContent = msg;
}

function showToast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 1600);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metaFor(id: string): TranslationMeta | undefined {
  return translations.find((t) => t.id === id);
}

function tafsirMetaFor(id: string): TafsirMeta | undefined {
  return tafsirs.find((t) => t.id === id);
}

function updateTranslationButton() {
  const meta = metaFor(activeTranslationId);
  translationName.textContent = meta?.englishName || meta?.name || activeTranslationId;
}

function updateTafsirButton() {
  const meta = tafsirMetaFor(activeTafsirId);
  tafsirName.textContent = meta?.name || activeTafsirId || "None";
}

function updateChrome() {
  const atRoot =
    (mode === "quran" && quranView === "surahs") ||
    (mode === "hadith" && hadithView === "collections");

  navBar.classList.toggle("hidden", atRoot);
  translationBtn.classList.toggle("hidden", mode !== "quran");
  tafsirBtn.classList.toggle("hidden", mode !== "quran" || !tafsirs.length);

  if (mode === "quran") {
    if (quranView === "ayahs" && activeSurah != null && arabicCache) {
      const s = arabicCache.surahs.find((x) => x.number === activeSurah);
      navPath.textContent = s
        ? `${s.number}. ${s.englishName}`
        : `Surah ${activeSurah}`;
      searchInput.placeholder = "Search verses…";
    } else {
      navPath.textContent = "";
      searchInput.placeholder = "Search chapters…";
    }
  } else if (hadithView === "chapters" && activeBook) {
    navPath.textContent = activeBook.title;
    searchInput.placeholder = "Search chapters…";
  } else if (hadithView === "hadiths" && activeBook) {
    const ch = activeBook.chapters?.find((c) => c.id === activeHadithChapterId);
    const chapterLabel = ch
      ? `${ch.id}. ${ch.english || "Chapter"}`
      : activeHadithChapterId != null
        ? `Chapter ${activeHadithChapterId}`
        : "Hadiths";
    navPath.textContent = `${activeBook.title} · ${chapterLabel}`;
    searchInput.placeholder = "Search hadiths…";
  } else {
    navPath.textContent = "";
    searchInput.placeholder = "Search collections…";
  }
}

const copyPanel = createCopyPanel(showToast);
const list = createVirtualList(viewport, spacer, windowEl, {
  onCardClick: (item) => copyPanel.open(item),
  onNavClick: (item) => {
    void openNav(item);
  },
});

async function ensureQuranLoaded() {
  if (arabicCache && translationTexts.length) return;
  setStatus("Loading Quran…");
  const [arabic, translation] = await Promise.all([
    loadArabicQuran(),
    loadTranslation(activeTranslationId),
  ]);
  arabicCache = arabic;
  translationTexts = translation.texts;
}

async function ensureTafsirLoaded() {
  if (!activeTafsirId || !tafsirs.length) {
    tafsirTexts = [];
    return;
  }
  if (tafsirTexts.length) return;
  try {
    setStatus("Loading tafsir…");
    const file = await loadTafsir(activeTafsirId);
    tafsirTexts = file.texts;
  } catch {
    tafsirTexts = [];
  }
}

async function ensureHadithBook(slug: string) {
  if (activeBook?.slug === slug) return activeBook;
  setStatus("Loading collection…");
  activeBook = await loadHadithBook(slug);
  return activeBook;
}

function surahNavItems(): NavItem[] {
  if (!arabicCache) return [];
  return arabicCache.surahs.map((s) => ({
    kind: "nav" as const,
    key: `surah-${s.number}`,
    target: String(s.number),
    index: String(s.number).padStart(2, "0"),
    title: s.englishName,
    subtitle: `${s.name} · ${s.englishNameTranslation}`,
    badge: `${s.ayahCount} verses`,
  }));
}

function ayahCardsForSurah(surah: number): CardItem[] {
  if (!arabicCache) return [];
  const label = metaFor(activeTranslationId)?.englishName || "Translation";
  const tfLabel = tafsirMetaFor(activeTafsirId)?.name || "Tafsir";
  const surahMeta = arabicCache.surahs.find((s) => s.number === surah);
  const name = surahMeta?.englishName || `Surah ${surah}`;

  return arabicCache.ayahs
    .map((ayah, i) => ({ ayah, i }))
    .filter(({ ayah }) => ayah.s === surah)
    .map(({ ayah, i }) => ({
      kind: "card" as const,
      key: `q-${ayah.n}`,
      ref: `${name} ${ayah.s}:${ayah.a}`,
      arabic: ayah.t,
      translation: translationTexts[i] || "",
      translationLabel: label,
      tafsir: tafsirTexts[i] || "",
      tafsirLabel: tfLabel,
    }));
}

function collectionNavItems(): NavItem[] {
  return books.map((b, i) => ({
    kind: "nav" as const,
    key: `book-${b.slug}`,
    target: b.slug,
    index: String(i + 1).padStart(2, "0"),
    title: b.title,
    subtitle: b.titleAr || undefined,
    badge: b.count ? `${b.count} hadiths` : undefined,
  }));
}

function chapterNavItems(book: HadithBook): NavItem[] {
  const chapters = book.chapters || [];
  if (!chapters.length) {
    return [
      {
        kind: "nav",
        key: `ch-${book.slug}-all`,
        target: "0",
        index: "01",
        title: "All hadiths",
        subtitle: book.titleAr || undefined,
        badge: `${book.hadiths.length} hadiths`,
      },
    ];
  }

  const counts = new Map<number, number>();
  for (const h of book.hadiths) {
    const id = h.chapterId ?? 0;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  return chapters.map((c) => ({
    kind: "nav" as const,
    key: `ch-${book.slug}-${c.id}`,
    target: String(c.id),
    index: String(c.id).padStart(2, "0"),
    title: c.english || `Chapter ${c.id}`,
    subtitle: c.arabic || undefined,
    badge: `${counts.get(c.id) || 0}`,
  }));
}

function hadithCardsForChapter(book: HadithBook, chapterId: number): CardItem[] {
  return book.hadiths
    .filter((h) => (h.chapterId ?? 0) === chapterId || (chapterId === 0 && !book.chapters?.length))
    .map((h) => ({
      kind: "card" as const,
      key: `h-${book.slug}-${h.id}`,
      ref: h.ref,
      arabic: h.arabic,
      translation: h.english,
      translationLabel: "English",
    }));
}

function renderCurrentView() {
  updateChrome();
  const q = searchInput.value;

  if (mode === "quran") {
    if (quranView === "surahs") {
      const items = filterNavByText(surahNavItems(), q);
      list.setItems(items, items.length ? undefined : "No chapters match.");
      setStatus(`${items.length} chapters`);
      return;
    }

    if (activeSurah == null) return;
    const cards = filterCards(ayahCardsForSurah(activeSurah), q);
    list.setItems(cards, cards.length ? undefined : "No verses match.");
    setStatus(`${cards.length} verses`);
    return;
  }

  // Hadith
  if (hadithView === "collections") {
    const items = filterNavByText(collectionNavItems(), q);
    list.setItems(items, items.length ? undefined : "No collections match.");
    setStatus(`${items.length} collections`);
    return;
  }

  if (hadithView === "chapters" && activeBook) {
    const items = filterNavByText(chapterNavItems(activeBook), q);
    list.setItems(items, items.length ? undefined : "No chapters match.");
    setStatus(`${items.length} chapters`);
    return;
  }

  if (hadithView === "hadiths" && activeBook && activeHadithChapterId != null) {
    const cards = filterCards(
      hadithCardsForChapter(activeBook, activeHadithChapterId),
      q,
    );
    list.setItems(cards, cards.length ? undefined : "No hadiths match.");
    setStatus(`${cards.length} hadiths`);
  }
}

async function openNav(item: NavItem) {
  searchInput.value = "";

  if (mode === "quran") {
    activeSurah = Number(item.target);
    quranView = "ayahs";
    await ensureTafsirLoaded();
    renderCurrentView();
    return;
  }

  if (hadithView === "collections") {
    await ensureHadithBook(item.target);
    hadithView = "chapters";
    activeHadithChapterId = null;
    renderCurrentView();
    return;
  }

  if (hadithView === "chapters") {
    activeHadithChapterId = Number(item.target);
    hadithView = "hadiths";
    renderCurrentView();
  }
}

function goBack() {
  searchInput.value = "";

  if (mode === "quran" && quranView === "ayahs") {
    quranView = "surahs";
    activeSurah = null;
    renderCurrentView();
    return;
  }

  if (mode === "hadith" && hadithView === "hadiths") {
    hadithView = "chapters";
    activeHadithChapterId = null;
    renderCurrentView();
    return;
  }

  if (mode === "hadith" && hadithView === "chapters") {
    hadithView = "collections";
    activeBook = null;
    renderCurrentView();
  }
}

const onSearch = debounce(() => renderCurrentView(), 200);
searchInput.addEventListener("input", onSearch);
backBtn.addEventListener("click", goBack);

function renderTranslationPicker(filter = "") {
  const q = filter.trim().toLowerCase();
  const filtered = translations.filter((t) => {
    if (!q) return true;
    return (
      t.englishName.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  });

  const frag = document.createDocumentFragment();
  for (const t of filtered) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "picker-item" + (t.id === activeTranslationId ? " active" : "");
    btn.innerHTML = `<span>${escapeHtml(t.englishName || t.name)}</span><span class="sub">${escapeHtml(t.name)} · ${escapeHtml(t.id)}</span>`;
    btn.addEventListener("click", () => {
      void selectTranslation(t.id);
    });
    frag.appendChild(btn);
  }

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.style.margin = "12px";
    empty.textContent = "No translations match.";
    frag.appendChild(empty);
  }

  transList.replaceChildren(frag);
}

function openTranslationPicker() {
  transSearch.value = "";
  renderTranslationPicker();
  transOverlay.classList.remove("hidden");
  transSearch.focus();
}

function closeTranslationPicker() {
  transOverlay.classList.add("hidden");
}

translationBtn.addEventListener("click", openTranslationPicker);
transClose.addEventListener("click", closeTranslationPicker);
transOverlay.addEventListener("click", (e) => {
  if (e.target === transOverlay) closeTranslationPicker();
});
transSearch.addEventListener("input", () => renderTranslationPicker(transSearch.value));

function renderTafsirPicker(filter = "") {
  const q = filter.trim().toLowerCase();
  const filtered = tafsirs.filter((t) => {
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.languageName.toLowerCase().includes(q)
    );
  });

  const frag = document.createDocumentFragment();

  // Option to hide tafsir
  const noneBtn = document.createElement("button");
  noneBtn.type = "button";
  noneBtn.className = "picker-item" + (!activeTafsirId ? " active" : "");
  noneBtn.innerHTML = `<span>None</span><span class="sub">Hide tafsir on verses</span>`;
  noneBtn.addEventListener("click", () => {
    void selectTafsir("");
  });
  frag.appendChild(noneBtn);

  for (const t of filtered) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "picker-item" + (t.id === activeTafsirId ? " active" : "");
    btn.innerHTML = `<span>${escapeHtml(t.name)}</span><span class="sub">${escapeHtml(t.languageName)} · ${escapeHtml(t.id)}</span>`;
    btn.addEventListener("click", () => {
      void selectTafsir(t.id);
    });
    frag.appendChild(btn);
  }

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.style.margin = "12px";
    empty.textContent = "No tafsirs match.";
    frag.appendChild(empty);
  }

  tafsirList.replaceChildren(frag);
}

function openTafsirPicker() {
  tafsirSearch.value = "";
  renderTafsirPicker();
  tafsirOverlay.classList.remove("hidden");
  tafsirSearch.focus();
}

function closeTafsirPicker() {
  tafsirOverlay.classList.add("hidden");
}

tafsirBtn.addEventListener("click", openTafsirPicker);
tafsirClose.addEventListener("click", closeTafsirPicker);
tafsirOverlay.addEventListener("click", (e) => {
  if (e.target === tafsirOverlay) closeTafsirPicker();
});
tafsirSearch.addEventListener("input", () => renderTafsirPicker(tafsirSearch.value));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!transOverlay.classList.contains("hidden")) {
      closeTranslationPicker();
      return;
    }
    if (!tafsirOverlay.classList.contains("hidden")) {
      closeTafsirPicker();
      return;
    }
    if (!navBar.classList.contains("hidden")) goBack();
  }
});

async function selectTranslation(id: string) {
  activeTranslationId = id;
  localStorage.setItem(LS_TRANSLATION, id);
  updateTranslationButton();
  closeTranslationPicker();

  translationTexts = [];
  await ensureQuranLoaded();
  const file = await loadTranslation(id);
  translationTexts = file.texts;
  if (mode === "quran") renderCurrentView();
}

async function selectTafsir(id: string) {
  activeTafsirId = id;
  if (id) localStorage.setItem(LS_TAFSIR, id);
  else localStorage.removeItem(LS_TAFSIR);
  updateTafsirButton();
  closeTafsirPicker();
  tafsirTexts = [];
  await ensureTafsirLoaded();
  if (mode === "quran") renderCurrentView();
}

document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const next = btn.dataset.mode as Mode;
    if (next === mode) return;
    mode = next;
    document.querySelectorAll(".mode-btn").forEach((b) => {
      const active = (b as HTMLElement).dataset.mode === mode;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    searchInput.value = "";
    if (mode === "quran") {
      quranView = "surahs";
      activeSurah = null;
      void (async () => {
        await ensureQuranLoaded();
        renderCurrentView();
      })();
    } else {
      hadithView = "collections";
      activeBook = null;
      activeHadithChapterId = null;
      renderCurrentView();
    }
  });
});

async function boot() {
  try {
    setStatus("Loading…");
    const allTranslations = await loadTranslationsIndex();
    translations = allTranslations.filter((t) => t.language === "en");
    if (!metaFor(activeTranslationId)) {
      activeTranslationId =
        translations.find((t) => t.id === DEFAULT_TRANSLATION)?.id ||
        translations[0]?.id ||
        DEFAULT_TRANSLATION;
      localStorage.setItem(LS_TRANSLATION, activeTranslationId);
    }
    updateTranslationButton();

    tafsirs = await loadTafsirsIndex();
    if (activeTafsirId && !tafsirMetaFor(activeTafsirId)) {
      activeTafsirId =
        tafsirs.find((t) => t.id === DEFAULT_TAFSIR)?.id || tafsirs[0]?.id || "";
      if (activeTafsirId) localStorage.setItem(LS_TAFSIR, activeTafsirId);
    }
    updateTafsirButton();

    books = await loadHadithIndex();
    await ensureQuranLoaded();
    await ensureTafsirLoaded();
    renderCurrentView();
  } catch (err) {
    console.error(err);
    setStatus(
      "Data not found. Reinstall the app or run: npm run fetch-data",
    );
  }
}

void boot();
