import type {
  ArabicQuran,
  HadithBook,
  HadithBookMeta,
  TafsirFile,
  TafsirMeta,
  TranslationFile,
  TranslationMeta,
} from "./types";

const cache = new Map<string, unknown>();

async function loadJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit !== undefined) return hit as T;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const data = (await res.json()) as T;
  cache.set(url, data);
  return data;
}

/** Drop cached payloads under a path prefix except the keepUrl (if any). */
function evictPrefix(prefix: string, keepUrl?: string) {
  for (const key of cache.keys()) {
    if (!key.includes(prefix)) continue;
    if (keepUrl && key === keepUrl) continue;
    if (prefix === "/tafsirs/" && key.endsWith("tafsirs-index.json")) continue;
    if (prefix === "/hadith/" && key.endsWith("books-index.json")) continue;
    cache.delete(key);
  }
}

export async function loadTranslationsIndex(): Promise<TranslationMeta[]> {
  return loadJson("/data/quran/translations-index.json");
}

export async function loadArabicQuran(): Promise<ArabicQuran> {
  return loadJson("/data/quran/arabic.json");
}

export async function loadTranslation(id: string): Promise<TranslationFile> {
  const url = `/data/quran/translations/${id}.json`;
  evictPrefix("/translations/", url);
  return loadJson(url);
}

export async function loadTafsirsIndex(): Promise<TafsirMeta[]> {
  try {
    return await loadJson("/data/quran/tafsirs-index.json");
  } catch {
    return [];
  }
}

export async function loadTafsir(id: string): Promise<TafsirFile> {
  const url = `/data/quran/tafsirs/${id}.json`;
  evictPrefix("/tafsirs/", url);
  return loadJson(url);
}

export async function loadHadithIndex(): Promise<HadithBookMeta[]> {
  return loadJson("/data/hadith/books-index.json");
}

export async function loadHadithBook(slug: string): Promise<HadithBook> {
  const url = `/data/hadith/${slug}.json`;
  evictPrefix("/hadith/", url);
  return loadJson(url);
}
