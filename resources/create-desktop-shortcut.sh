#!/bin/bash
# Creates a desktop launcher in ~/.local/share/applications for portable / unzipped eenky builds
set -e

HERE="$(dirname "$(readlink -f "${0}")")"
TARGET_DIR="${HOME}/.local/share/applications"
mkdir -p "${TARGET_DIR}"

ICON_PATH="${HERE}/icon.png"
if [ ! -f "${ICON_PATH}" ]; then
    ICON_PATH="${HERE}/resources/Icon512.png"
fi

cat > "${TARGET_DIR}/eenky.desktop" <<EOF
[Desktop Entry]
Name=eenky
Comment=The story editor for ereaders running the eenk firmware
Exec="${HERE}/eenky.sh" %U
Icon=${ICON_PATH}
Terminal=false
Type=Application
Categories=Development;IDE;
StartupWMClass=eenky
EOF

chmod +x "${TARGET_DIR}/eenky.desktop"
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "${TARGET_DIR}" 2>/dev/null || true
fi

echo "Desktop shortcut created at ${TARGET_DIR}/eenky.desktop"
