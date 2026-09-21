# Quran & Hadith Reader

Offline desktop reader for the Quran (all AlQuran Cloud text translations) and 17 hadith collections. Built with Tauri 2 + Vite.

## Install (.deb)

```bash
npm run deb
# then:
pkexec dpkg -i packaging/quran-hadith-reader_0.1.0_arm64.deb
# or: sudo dpkg -i packaging/quran-hadith-reader_0.1.0_arm64.deb
```

After install, run from the app menu (**Quran & Hadith Reader**) or:

```bash
quran-hadith-reader
```

## Search checks

```bash
npm run test:search
```

## Features

- Matte black UI with gold outlines
- Quran.com-style translation picker (lazy-loads one translation at a time)
- All major hadith books (one book loaded at a time)
- Search within the active collection
- Click a card to copy Arabic, translation, or both
