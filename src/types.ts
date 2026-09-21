export type Mode = "quran" | "hadith";

export interface TranslationMeta {
  id: string;
  language: string;
  languageName: string;
  name: string;
  englishName: string;
  direction: string;
}

export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  ayahCount: number;
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
}

/** Clickable row for collections / chapters. */
export interface NavItem {
  kind: "nav";
  key: string;
  title: string;
  subtitle?: string;
  badge?: string;
  /** Payload for navigation handlers. */
  target: string;
}

export type ListItem = CardItem | NavItem;
