#!/usr/bin/env bash
# Build a .deb that installs Quran & Hadith Reader system-wide.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${VERSION:-0.1.6}"
ARCH="$(dpkg --print-architecture)"
PKG_NAME="quran-hadith-reader"
DEB_DIR="$ROOT/packaging/${PKG_NAME}_${VERSION}_${ARCH}"
OUT_DEB="$ROOT/packaging/${PKG_NAME}_${VERSION}_${ARCH}.deb"

echo "==> Building frontend + data bundle"
npm run build

if [[ ! -f dist/index.html || ! -f dist/data/quran/arabic.json ]]; then
  echo "dist/ is incomplete. Run: npm run fetch-data && npm run build" >&2
  exit 1
fi

if [[ ! -f assets/app-icon.png ]]; then
  echo "Missing assets/app-icon.png" >&2
  exit 1
fi

echo "==> Assembling package tree"
rm -rf "$DEB_DIR"
mkdir -p \
  "$DEB_DIR/DEBIAN" \
  "$DEB_DIR/usr/bin" \
  "$DEB_DIR/usr/share/${PKG_NAME}/assets" \
  "$DEB_DIR/usr/share/applications" \
  "$DEB_DIR/usr/share/pixmaps" \
  "$DEB_DIR/usr/share/doc/${PKG_NAME}"

cp -a dist "$DEB_DIR/usr/share/${PKG_NAME}/"
cp launch.py "$DEB_DIR/usr/share/${PKG_NAME}/launch.py"
chmod 755 "$DEB_DIR/usr/share/${PKG_NAME}/launch.py"
cp assets/app-icon.png "$DEB_DIR/usr/share/${PKG_NAME}/assets/app-icon.png"

cat > "$DEB_DIR/usr/bin/quran-hadith-reader" <<'EOF'
#!/bin/bash
exec /usr/bin/python3 /usr/share/quran-hadith-reader/launch.py "$@"
EOF
chmod 755 "$DEB_DIR/usr/bin/quran-hadith-reader"

# GNOME-friendly desktop entry (absolute Exec/TryExec, Education category)
cat > "$DEB_DIR/usr/share/applications/quran-hadith-reader.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Version=1.5
Name=Quran & Hadith Reader
GenericName=Quran Reader
Comment=Offline Quran and Hadith reader
Exec=/usr/bin/quran-hadith-reader
TryExec=/usr/bin/quran-hadith-reader
Icon=quran-hadith-reader
Terminal=false
StartupNotify=true
Categories=Education;
Keywords=Quran;Hadith;Islam;Arabic;Muslim;Sunnah;
MimeType=
EOF

ROOT="$ROOT" DEB_DIR="$DEB_DIR" python3 - <<'PY'
import os
from pathlib import Path
from PIL import Image

root = Path(os.environ["ROOT"])
deb = Path(os.environ["DEB_DIR"])
src = Image.open(root / "assets/app-icon.png").convert("RGBA")

# Theme icons (including common menu sizes)
for size in (16, 22, 24, 32, 48, 64, 128, 256, 512):
    out = deb / f"usr/share/icons/hicolor/{size}x{size}/apps/quran-hadith-reader.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    src.resize((size, size), Image.Resampling.LANCZOS).save(out)

# Classic pixmap fallback used by some menus
src.resize((128, 128), Image.Resampling.LANCZOS).save(
    deb / "usr/share/pixmaps/quran-hadith-reader.png"
)
print("icons ok")
PY

cp README.md "$DEB_DIR/usr/share/doc/${PKG_NAME}/README.md" 2>/dev/null || true
cat > "$DEB_DIR/usr/share/doc/${PKG_NAME}/copyright" <<EOF
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: Quran & Hadith Reader
Files: *
Copyright: 2026
License: proprietary
Comment: Quran and hadith JSON data retain their upstream licenses (AlQuran Cloud / hadith-json).
EOF

INSTALLED_SIZE="$(du -sk "$DEB_DIR/usr" | awk '{print $1}')"

cat > "$DEB_DIR/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: education
Priority: optional
Architecture: ${ARCH}
Installed-Size: ${INSTALLED_SIZE}
Depends: python3, python3-gi, gir1.2-gtk-3.0, gir1.2-webkit2-4.1
Maintainer: Nox <nox@localhost>
Description: Offline Quran and Hadith desktop reader
 Matte-black / gold card reader for the Quran (English translations)
 and major hadith collections. Fully offline after install.
EOF

cat > "$DEB_DIR/DEBIAN/postinst" <<'EOF'
#!/bin/bash
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi
# Touch desktop file so GNOME Shell picks up the change
touch /usr/share/applications/quran-hadith-reader.desktop || true
EOF
chmod 755 "$DEB_DIR/DEBIAN/postinst"

cat > "$DEB_DIR/DEBIAN/postrm" <<'EOF'
#!/bin/bash
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi
EOF
chmod 755 "$DEB_DIR/DEBIAN/postrm"

echo "==> Building .deb"
mkdir -p "$ROOT/packaging"
fakeroot dpkg-deb --build "$DEB_DIR" "$OUT_DEB"
desktop-file-validate "$DEB_DIR/usr/share/applications/quran-hadith-reader.desktop" || true
dpkg-deb -I "$OUT_DEB"
ls -lh "$OUT_DEB"
echo "Built: $OUT_DEB"
