export type Mode = "quran" | "hadith";

export interface TranslationMeta {
  id: string;
  language: string;
  languageName: string;
  name: string;
  englishName: string;
  /** Present in fetched metadata; unused by UI. */
  direction?: string;
}

export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  ayahCount: number;
  /** Present in fetched metadata; unused by UI. */
  revelationType?: string;
}

export interface ArabicAyah {
  n: number;
  s: number;
  a: number;
  t: string;
}

export interface ArabicQuran {
  surahs: SurahMeta[];
  ayahs: ArabicAyah[];
}

export interface TranslationFile {
  id: string;
  texts: string[];
}

export interface TafsirMeta {
  id: string;
  name: string;
  language: string;
  languageName: string;
}

export interface TafsirFile {
  id: string;
  texts: string[];
}

export interface HadithBookMeta {
  slug: string;
  title: string;
  titleAr: string;
  count?: number;
}

export interface HadithChapter {
  id: number;
  arabic: string;
  english: string;
}

export interface HadithEntry {
  id: number;
  ref: string;
  chapterId: number | null;
  arabic: string;
  english: string;
}

export interface HadithBook {
  slug: string;
  title: string;
  titleAr: string;
  chapters?: HadithChapter[];
  hadiths: HadithEntry[];
}

export interface CardItem {
  kind: "card";
  key: string;
  ref: string;
  arabic: string;
  translation: string;
  translationLabel: string;
  tafsir?: string;
  tafsirLabel?: string;
}

/** Clickable row for collections / chapters. */
export interface NavItem {
  kind: "nav";
  key: string;
  title: string;
  subtitle?: string;
  badge?: string;
  /** Left index label, e.g. "01". */
  index?: string;
  /** Payload for navigation handlers. */
  target: string;
}

export type ListItem = CardItem | NavItem;
