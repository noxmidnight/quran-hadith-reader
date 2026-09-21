#!/usr/bin/env node
/**
 * Downloads Quran (Arabic + all text translations) and all hadith books offline.
 * Idempotent: skips files that already exist.
 */
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const QURAN_DIR = join(ROOT, "public/data/quran");
const TRANS_DIR = join(QURAN_DIR, "translations");
const HADITH_DIR = join(ROOT, "public/data/hadith");

const QURAN_API = "https://api.alquran.cloud/v1";
const HADITH_TAG = "v1.2.0";
const HADITH_RAW = `https://raw.githubusercontent.com/AhmedBaset/hadith-json/${HADITH_TAG}`;

const HADITH_BOOKS = [
  { slug: "bukhari", path: "db/by_book/the_9_books/bukhari.json", title: "Sahih al-Bukhari", titleAr: "صحيح البخاري" },
  { slug: "muslim", path: "db/by_book/the_9_books/muslim.json", title: "Sahih Muslim", titleAr: "صحيح مسلم" },
  { slug: "abudawud", path: "db/by_book/the_9_books/abudawud.json", title: "Sunan Abi Dawud", titleAr: "سنن أبي داود" },
  { slug: "tirmidhi", path: "db/by_book/the_9_books/tirmidhi.json", title: "Jami' at-Tirmidhi", titleAr: "جامع الترمذي" },
  { slug: "nasai", path: "db/by_book/the_9_books/nasai.json", title: "Sunan an-Nasa'i", titleAr: "سنن النسائي" },
  { slug: "ibnmajah", path: "db/by_book/the_9_books/ibnmajah.json", title: "Sunan Ibn Majah", titleAr: "سنن ابن ماجه" },
  { slug: "malik", path: "db/by_book/the_9_books/malik.json", title: "Muwatta Malik", titleAr: "موطأ مالك" },
  { slug: "ahmed", path: "db/by_book/the_9_books/ahmed.json", title: "Musnad Ahmad", titleAr: "مسند أحمد" },
  { slug: "darimi", path: "db/by_book/the_9_books/darimi.json", title: "Sunan ad-Darimi", titleAr: "سنن الدارمي" },
  { slug: "riyad_assalihin", path: "db/by_book/other_books/riyad_assalihin.json", title: "Riyad as-Salihin", titleAr: "رياض الصالحين" },
  { slug: "shamail_muhammadiyah", path: "db/by_book/other_books/shamail_muhammadiyah.json", title: "Shamail Muhammadiyah", titleAr: "الشمائل المحمدية" },
  { slug: "bulugh_almaram", path: "db/by_book/other_books/bulugh_almaram.json", title: "Bulugh al-Maram", titleAr: "بلوغ المرام" },
  { slug: "aladab_almufrad", path: "db/by_book/other_books/aladab_almufrad.json", title: "Al-Adab Al-Mufrad", titleAr: "الأدب المفرد" },
  { slug: "mishkat_almasabih", path: "db/by_book/other_books/mishkat_almasabih.json", title: "Mishkat al-Masabih", titleAr: "مشكاة المصابيح" },
  { slug: "nawawi40", path: "db/by_book/forties/nawawi40.json", title: "Forty Hadith of an-Nawawi", titleAr: "الأربعون النووية" },
  { slug: "qudsi40", path: "db/by_book/forties/qudsi40.json", title: "Forty Hadith Qudsi", titleAr: "الأربعون القدسية" },
  { slug: "shahwaliullah40", path: "db/by_book/forties/shahwaliullah40.json", title: "Forty Hadith of Shah Waliullah", titleAr: "أربعون شاه ولي الله" },
];

const LANG_NAMES = {
  en: "English", ar: "Arabic", ur: "Urdu", fr: "French", es: "Spanish", de: "German",
  id: "Indonesian", tr: "Turkish", bn: "Bengali", ru: "Russian", zh: "Chinese",
  fa: "Persian", hi: "Hindi", ms: "Malay", nl: "Dutch", pt: "Portuguese",
  it: "Italian", ja: "Japanese", ko: "Korean", sv: "Swedish", th: "Thai",
  az: "Azerbaijani", bs: "Bosnian", cs: "Czech", dv: "Divehi", ha: "Hausa",
  ku: "Kurdish", ml: "Malayalam", no: "Norwegian", pl: "Polish", ro: "Romanian",
  sq: "Albanian", sw: "Swahili", ta: "Tamil", tg: "Tajik", tt: "Tatar",
  uz: "Uzbek", am: "Amharic", ber: "Berber", cy: "Welsh", si: "Sinhala",
};

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "Accept-Encoding": "gzip" },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = 800 * (i + 1);
      console.warn(`  retry ${i + 1} for ${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data), "utf8");
}

function stripBom(s) {
  return typeof s === "string" ? s.replace(/^\uFEFF/, "").trim() : "";
}

function flattenQuranEdition(payload) {
  const surahs = payload.data?.surahs ?? payload.surahs;
  const ayahs = [];
  for (const surah of surahs) {
    for (const ayah of surah.ayahs) {
      ayahs.push({
        n: ayah.number,
        s: surah.number,
        a: ayah.numberInSurah,
        t: stripBom(ayah.text),
      });
    }
  }
  return ayahs;
}

async function fetchQuranArabic() {
  const out = join(QURAN_DIR, "arabic.json");
  if (await exists(out)) {
    console.log("skip arabic.json");
    return;
  }
  console.log("fetching Arabic Quran…");
  const raw = await fetchJson(`${QURAN_API}/quran/quran-uthmani`);
  const ayahs = flattenQuranEdition(raw);
  const surahs = (raw.data?.surahs ?? []).map((s) => ({
    number: s.number,
    name: s.name,
    englishName: s.englishName,
    englishNameTranslation: s.englishNameTranslation,
    revelationType: s.revelationType,
    ayahCount: s.ayahs.length,
  }));
  await writeJson(out, { surahs, ayahs });
  console.log(`  wrote arabic.json (${ayahs.length} ayahs)`);
}

async function fetchTranslations() {
  console.log("fetching translation catalog…");
  const catalog = await fetchJson(`${QURAN_API}/edition?type=translation&format=text`);
  const editions = (catalog.data ?? [])
    .filter((e) => e.language === "en")
    .map((e) => ({
      id: e.identifier,
      language: e.language,
      languageName: LANG_NAMES[e.language] || e.language.toUpperCase(),
      name: e.name,
      englishName: e.englishName,
      direction: e.direction || "ltr",
    }));

  editions.sort((a, b) => a.englishName.localeCompare(b.englishName));

  await writeJson(join(QURAN_DIR, "translations-index.json"), editions);
  console.log(`  ${editions.length} English translations`);

  let done = 0;
  for (const ed of editions) {
    const out = join(TRANS_DIR, `${ed.id}.json`);
    if (await exists(out)) {
      done++;
      continue;
    }
    process.stdout.write(`  [${++done}/${editions.length}] ${ed.id}… `);
    try {
      const raw = await fetchJson(`${QURAN_API}/quran/${ed.id}`);
      const ayahs = flattenQuranEdition(raw);
      // Store only texts in ayah order — arabic.json holds refs
      await writeJson(out, {
        id: ed.id,
        texts: ayahs.map((a) => a.t),
      });
      console.log("ok");
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

function normalizeHadithEnglish(english) {
  if (!english) return "";
  if (typeof english === "string") return english.trim();
  const narrator = (english.narrator || "").trim();
  const text = (english.text || "").replace(/\s+/g, " ").trim();
  return [narrator, text].filter(Boolean).join("\n");
}

async function fetchHadithBooks() {
  const index = [];
  for (const book of HADITH_BOOKS) {
    const out = join(HADITH_DIR, `${book.slug}.json`);
    index.push({
      slug: book.slug,
      title: book.title,
      titleAr: book.titleAr,
    });

    if (await exists(out)) {
      console.log(`skip hadith ${book.slug}`);
      // refresh count from existing if possible
      try {
        const existing = JSON.parse(await readFile(out, "utf8"));
        index[index.length - 1].count = existing.hadiths?.length ?? 0;
      } catch {
        index[index.length - 1].count = 0;
      }
      continue;
    }

    console.log(`fetching hadith ${book.slug}…`);
    const raw = await fetchJson(`${HADITH_RAW}/${book.path}`);
    const meta = raw.metadata || {};
    const title = meta.english?.title || book.title;
    const titleAr = meta.arabic?.title || book.titleAr;
    const hadiths = (raw.hadiths || [])
      .filter((h) => typeof h.arabic === "string" && h.arabic.length > 20)
      .map((h) => ({
        id: h.id,
        ref: `${title} ${h.idInBook ?? h.id}`,
        chapterId: h.chapterId ?? null,
        arabic: stripBom(h.arabic),
        english: normalizeHadithEnglish(h.english),
      }));

    await writeJson(out, {
      slug: book.slug,
      title,
      titleAr,
      chapters: (raw.chapters || []).map((c) => ({
        id: c.id,
        arabic: typeof c.arabic === "string" ? c.arabic : "",
        english: typeof c.english === "string" ? c.english : "",
      })),
      hadiths,
    });
    index[index.length - 1].title = title;
    index[index.length - 1].titleAr = titleAr;
    index[index.length - 1].count = hadiths.length;
    console.log(`  wrote ${book.slug}.json (${hadiths.length} hadiths)`);
  }

  await writeJson(join(HADITH_DIR, "books-index.json"), index);
  console.log("wrote books-index.json");
}

async function main() {
  await mkdir(TRANS_DIR, { recursive: true });
  await mkdir(HADITH_DIR, { recursive: true });
  await fetchQuranArabic();
  await fetchTranslations();
  await fetchHadithBooks();
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
