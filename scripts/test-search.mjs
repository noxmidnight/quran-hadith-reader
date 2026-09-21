#!/usr/bin/env node
/**
 * Offline search regression checks against bundled Quran + Bukhari data.
 * Mirrors src/search.ts filtering rules.
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function normalizeArabic(text) {
  return text
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u08E3-\u08FF]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function normalizeSearchText(text) {
  return normalizeArabic(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s:.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAyahRef(q) {
  const colon = q.match(/^(\d{1,3})\s*[:：]\s*(\d{1,3})$/);
  if (colon) return { surah: Number(colon[1]), ayah: Number(colon[2]) };
  const spaced = q.match(/^(\d{1,3})\s+(\d{1,3})$/);
  if (spaced) return { surah: Number(spaced[1]), ayah: Number(spaced[2]) };
  return null;
}

function parseHadithNumber(q) {
  const m = q.match(/^(?:#|no\.?\s*|number\s*)(\d+)$/i);
  return m ? Number(m[1]) : null;
}

function ayahRefMatches(item, surah, ayah) {
  const m = item.ref.match(/(\d{1,3})\s*:\s*(\d{1,3})\s*$/);
  if (!m) return false;
  return Number(m[1]) === surah && Number(m[2]) === ayah;
}

function hadithNumberMatches(item, n) {
  if (item.ref.includes(":")) return false;
  const m = item.ref.match(/(\d+)\s*$/);
  return !!m && Number(m[1]) === n;
}

function filterCards(items, query) {
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
    const hay = normalizeSearchText(`${item.ref} ${item.arabic} ${item.translation}`);
    return tokens.every((t) => hay.includes(t));
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const arabic = JSON.parse(await readFile(join(root, "public/data/quran/arabic.json"), "utf8"));
  const sahih = JSON.parse(await readFile(join(root, "public/data/quran/translations/en.sahih.json"), "utf8"));
  const surahName = new Map(arabic.surahs.map((s) => [s.number, s.englishName]));
  const quran = arabic.ayahs.map((ayah, i) => ({
    key: `q-${ayah.n}`,
    ref: `${surahName.get(ayah.s)} ${ayah.s}:${ayah.a}`,
    arabic: ayah.t,
    translation: sahih.texts[i],
    translationLabel: "Saheeh International",
  }));

  const bukhari = JSON.parse(await readFile(join(root, "public/data/hadith/bukhari.json"), "utf8"));
  const hadith = bukhari.hadiths.map((h) => ({
    key: `h-${h.id}`,
    ref: h.ref,
    arabic: h.arabic,
    translation: h.english,
    translationLabel: "English",
  }));

  let hits = filterCards(quran, "2:255");
  assert(hits.length === 1, `2:255 expected 1 hit, got ${hits.length}`);
  assert(hits[0].ref.endsWith("2:255"), `got ${hits[0].ref}`);
  const kursi = normalizeSearchText(hits[0].arabic + " " + hits[0].translation);
  assert(kursi.includes("الله") || kursi.includes("kursi") || kursi.includes("throne") || kursi.includes("chair"), "Ayat al-Kursi content");
  console.log("OK  2:255 →", hits[0].ref);

  hits = filterCards(quran, "straight path");
  assert(hits.some((h) => /1:6/.test(h.ref)), "should include Al-Faatiha 1:6");
  console.log("OK  straight path →", hits.length, "hits");

  hits = filterCards(quran, "بسم الله");
  assert(hits.some((h) => h.ref.endsWith("1:1")), "should include 1:1");
  console.log("OK  بسم الله →", hits.length, "hits");

  hits = filterCards(quran, "baqara 255");
  assert(hits.some((h) => h.ref.endsWith("2:255")), "baqara 255 should find 2:255");
  console.log("OK  baqara 255 →", hits.filter((h) => h.ref.endsWith("2:255")).map((h) => h.ref).join(", "));

  hits = filterCards(quran, "believe unseen");
  assert(
    hits.every((h) => {
      const hay = normalizeSearchText(`${h.ref} ${h.arabic} ${h.translation}`);
      return hay.includes("believe") && hay.includes("unseen");
    }),
    "AND tokens must all match",
  );
  console.log("OK  believe unseen →", hits.length, "hits");

  hits = filterCards(hadith, "intentions");
  assert(hits.length >= 1, "intentions should match Bukhari");
  console.log("OK  intentions →", hits.length, "hits; first", hits[0].ref);

  hits = filterCards(hadith, "#1");
  assert(hits.length === 1, `#1 expected 1 hadith, got ${hits.length}`);
  assert(/1\s*$/.test(hits[0].ref), hits[0].ref);
  console.log("OK  #1 →", hits[0].ref);

  hits = filterCards(quran, "zzzxnotaword999");
  assert(hits.length === 0, "nonsense query must be empty");
  console.log("OK  nonsense → 0 hits");

  hits = filterCards(quran, "2 255");
  assert(hits.length === 1 && hits[0].ref.endsWith("2:255"), "2 255 should resolve like 2:255");
  console.log("OK  2 255 →", hits[0].ref);

  // Mercy should not return unrelated math refs
  hits = filterCards(quran, "Entirely Merciful");
  assert(hits.length >= 1, "Entirely Merciful");
  assert(hits.every((h) => /merciful/i.test(h.translation)), "all hits must mention merciful");
  console.log("OK  Entirely Merciful →", hits.length, "hits");

  console.log("\nAll search checks passed.");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
