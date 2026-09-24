# Quran & Hadith Reader

Offline desktop reader for the Quran (English translations + tafsirs) and 17 hadith collections. Vite frontend + Python/WebKit launcher.

## Install (.deb)

```bash
npm run fetch-data && npm run fetch-tafsirs   # first time only
npm run deb
pkexec dpkg -i packaging/quran-hadith-reader_*_arm64.deb
```

After install, run from the app menu (**Quran & Hadith Reader**) or:

```bash
quran-hadith-reader
```

## Dev

```bash
npm run fetch-data && npm run fetch-tafsirs
npm run build
npm start
```

## Features

- Matte black / gold UI with drill-down navigation
- Lazy-loaded English translations and verse tafsirs
- All major hadith books (one book in memory at a time)
- Virtualized lists, search, selective copy
