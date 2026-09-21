#!/usr/bin/env node
/**
 * Downloads English (and optional Arabic) tafsirs offline.
 * English: spa5k/tafsir_api (per-surah JSON)
 * Arabic: Al Quran Cloud tafsir editions
 */
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const QURAN_DIR = join(ROOT, "public/data/quran");
const TAFSIR_DIR = join(QURAN_DIR, "tafsirs");
const ARABIC_PATH = join(QURAN_DIR, "arabic.json");

const SPA5K = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir";
const QURAN_API = "https://api.alquran.cloud/v1";

/** Popular English tafsirs from spa5k */
const EN_TAFSIRS = [
  { id: "en-al-jalalayn", name: "Al-Jalalayn", language: "en" },
  { id: "en-tafisr-ibn-kathir", name: "Ibn Kathir (Abridged)", language: "en" },
  { id: "en-tafsir-ibn-abbas", name: "Ibn Abbas (Tanwir al-Miqbas)", language: "en" },
  { id: "en-tafsir-maarif-ul-quran", name: "Maarif-ul-Quran", language: "en" },
  { id: "en-tafsir-al-mukhtasar", name: "Al-Mukhtasar", language: "en" },
  { id: "en-tazkirul-quran", name: "Tazkirul Quran", language: "en" },
  { id: "en-al-qushairi-tafsir", name: "Al-Qushairi", language: "en" },
];

/** Arabic tafsirs from Al Quran Cloud */
const AR_TAFSIRS = [
  { id: "ar.jalalayn", name: "Tafsir al-Jalalayn", language: "ar" },
  { id: "ar.muyassar", name: "Tafsir al-Muyassar", language: "ar" },
];

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
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
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

function stripHtml(s) {
  return stripBom(s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function loadAyahIndex() {
  const arabic = JSON.parse(await readFile(ARABIC_PATH, "utf8"));
  /** Map "s:a" -> global 0-based index */
  const map = new Map();
  arabic.ayahs.forEach((a, i) => map.set(`${a.s}:${a.a}`, i));
  return { count: arabic.ayahs.length, map };
}

async function fetchSpa5kTafsir(edition, ayahCount, ayahMap) {
  const out = join(TAFSIR_DIR, `${edition.id}.json`);
  if (await exists(out)) {
    // Re-fetch if previous run wrote an empty file
    try {
      const prev = JSON.parse(await readFile(out, "utf8"));
      const filled = (prev.texts || []).filter(Boolean).length;
      if (filled > 0) {
        console.log(`skip ${edition.id} (${filled} ayahs)`);
        return filled;
      }
      console.log(`re-fetch ${edition.id} (was empty)…`);
    } catch {
      /* fall through */
    }
  } else {
    console.log(`fetching ${edition.id}…`);
  }
  const texts = new Array(ayahCount).fill("");
  for (let surah = 1; surah <= 114; surah++) {
    process.stdout.write(`  surah ${surah}/114\r`);
    const data = await fetchJson(`${SPA5K}/${edition.id}/${surah}.json`);
    // spa5k returns either { ayahs: [...] } or a bare [...]
    const ayahs = Array.isArray(data)
      ? data
      : data.ayahs || data.data?.ayahs || [];
    for (const a of ayahs) {
      const s = a.surah ?? surah;
      const n = a.ayah ?? a.numberInSurah ?? a.number;
      const idx = ayahMap.get(`${s}:${n}`);
      if (idx != null) texts[idx] = stripHtml(a.text || "");
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  await writeJson(out, { id: edition.id, texts });
  const filled = texts.filter(Boolean).length;
  console.log(`  wrote ${edition.id}.json (${filled}/${ayahCount} ayahs)`);
  return filled;
}

function flattenQuranEdition(payload) {
  const surahs = payload.data?.surahs ?? payload.surahs;
  const ayahs = [];
  for (const surah of surahs) {
    for (const ayah of surah.ayahs) {
      ayahs.push(stripHtml(ayah.text));
    }
  }
  return ayahs;
}

async function fetchCloudTafsir(edition, ayahCount) {
  const out = join(TAFSIR_DIR, `${edition.id}.json`);
  if (await exists(out)) {
    console.log(`skip ${edition.id}`);
    return;
  }
  console.log(`fetching ${edition.id}…`);
  const raw = await fetchJson(`${QURAN_API}/quran/${edition.id}`);
  const texts = flattenQuranEdition(raw);
  while (texts.length < ayahCount) texts.push("");
  await writeJson(out, { id: edition.id, texts: texts.slice(0, ayahCount) });
  console.log(`  wrote ${edition.id}.json (${texts.filter(Boolean).length} ayahs)`);
}

async function main() {
  if (!(await exists(ARABIC_PATH))) {
    console.error("Missing arabic.json — run npm run fetch-data first");
    process.exit(1);
  }
  await mkdir(TAFSIR_DIR, { recursive: true });
  const { count, map } = await loadAyahIndex();

  const index = [];
  for (const ed of EN_TAFSIRS) {
    const filled = await fetchSpa5kTafsir(ed, count, map);
    if (filled > 0) {
      index.push({ id: ed.id, name: ed.name, language: ed.language, languageName: "English" });
    } else {
      console.warn(`  omitting ${ed.id} (no ayahs)`);
    }
  }
  for (const ed of AR_TAFSIRS) {
    await fetchCloudTafsir(ed, count);
    index.push({ id: ed.id, name: ed.name, language: ed.language, languageName: "Arabic" });
  }

  await writeJson(join(QURAN_DIR, "tafsirs-index.json"), index);
  console.log(`wrote tafsirs-index.json (${index.length} editions)`);
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
