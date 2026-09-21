import type { CardItem } from "./types";

/** Strip Arabic diacritics / tatweel so search matches vocalized text. */
export function normalizeArabic(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u08E3-\u08FF]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

export function normalizeSearchText(text: string): string {
  return normalizeArabic(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s:.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAyahRef(q: string): { surah: number; ayah: number } | null {
  const colon = q.match(/^(\d{1,3})\s*[:：]\s*(\d{1,3})$/);
  if (colon) return { surah: Number(colon[1]), ayah: Number(colon[2]) };

  const spaced = q.match(/^(\d{1,3})\s+(\d{1,3})$/);
  if (spaced) return { surah: Number(spaced[1]), ayah: Number(spaced[2]) };

  return null;
}

function parseHadithNumber(q: string): number | null {
  const m = q.match(/^(?:#|no\.?\s*|number\s*)(\d+)$/i);
  return m ? Number(m[1]) : null;
}

function ayahRefMatches(item: CardItem, surah: number, ayah: number): boolean {
  const m = item.ref.match(/(\d{1,3})\s*:\s*(\d{1,3})\s*$/);
  if (!m) return false;
  return Number(m[1]) === surah && Number(m[2]) === ayah;
}

function hadithNumberMatches(item: CardItem, n: number): boolean {
  if (item.ref.includes(":")) return false;
  const m = item.ref.match(/(\d+)\s*$/);
  return !!m && Number(m[1]) === n;
}

export function filterCards(items: CardItem[], query: string): CardItem[] {
  const raw = query.trim();
  if (!raw) return items;

  const ayah = parseAyahRef(raw);
  if (ayah) {
    const hits = items.filter((item) => ayahRefMatches(item, ayah.surah, ayah.ayah));
    if (hits.length) return hits;
  }

  const hadithNo = parseHadithNumber(raw);
  if (hadithNo != null) {
    const hits = items.filter((item) => hadithNumberMatches(item, hadithNo));
    if (hits.length) return hits;
  }

  const tokens = normalizeSearchText(raw).split(" ").filter(Boolean);
  if (!tokens.length) return items;

  return items.filter((item) => {
    const hay = normalizeSearchText(
      `${item.ref} ${item.arabic} ${item.translation} ${item.tafsir || ""}`,
    );
    return tokens.every((t) => hay.includes(t));
  });
}

export function filterNavByText<T extends { title: string; subtitle?: string; badge?: string }>(
  items: T[],
  query: string,
): T[] {
  const q = normalizeSearchText(query);
  if (!q) return items;
  const tokens = q.split(" ").filter(Boolean);
  return items.filter((item) => {
    const hay = normalizeSearchText(`${item.title} ${item.subtitle || ""} ${item.badge || ""}`);
    return tokens.every((t) => hay.includes(t));
  });
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
