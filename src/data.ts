import type {
  ArabicQuran,
  HadithBook,
  HadithBookMeta,
  TranslationFile,
  TranslationMeta,
} from "./types";

const cache = new Map<string, unknown>();

async function loadJson<T>(url: string): Promise<T> {
  if (cache.has(url)) return cache.get(url) as T;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const data = (await res.json()) as T;
  cache.set(url, data);
  return data;
}

export function dropCache(urlPrefix?: string) {
  if (!urlPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) cache.delete(key);
  }
}

export async function loadTranslationsIndex(): Promise<TranslationMeta[]> {
  return loadJson("/data/quran/translations-index.json");
}

export async function loadArabicQuran(): Promise<ArabicQuran> {
  return loadJson("/data/quran/arabic.json");
}

export async function loadTranslation(id: string): Promise<TranslationFile> {
  // Keep only one translation payload besides indexes/arabic
  for (const key of [...cache.keys()]) {
    if (key.includes("/translations/") && !key.endsWith(`${id}.json`)) {
      cache.delete(key);
    }
  }
  return loadJson(`/data/quran/translations/${id}.json`);
}

export async function loadHadithIndex(): Promise<HadithBookMeta[]> {
  return loadJson("/data/hadith/books-index.json");
}

export async function loadHadithBook(slug: string): Promise<HadithBook> {
  for (const key of [...cache.keys()]) {
    if (key.includes("/hadith/") && key.endsWith(".json") && !key.endsWith("books-index.json") && !key.endsWith(`${slug}.json`)) {
      cache.delete(key);
    }
  }
  return loadJson(`/data/hadith/${slug}.json`);
}
