#!/bin/bash
# Buduje kiosk-setup_<wersja>_amd64.deb ze źródeł w tym katalogu.
#
#   ./build.sh                      – Piper (TTS) z katalogu ./piper albo $PIPER_DIR
#   ./build.sh --piper-from X.deb   – Piper wyciągnięty z wcześniejszego pakietu kiosk-setup
#   ./build.sh --no-piper           – bez Pipera (komunikaty głosowe tylko espeak-ng)
#
# Skrypty z src/ są wklejane do debian/postinst w miejsce bloków heredoc
# wymienionych w src/MANIFEST, więc edytuje się tylko pliki w src/.
set -euo pipefail
cd "$(dirname "$0")"
PIPER="${PIPER_DIR:-piper}"; FROMDEB=""; NOPIPER=0
while [ $# -gt 0 ]; do case "$1" in
  --piper-from) FROMDEB="$2"; shift 2;;
  --no-piper) NOPIPER=1; shift;;
  *) echo "nieznana opcja: $1"; exit 2;;
esac; done
VER=$(sed -n 's/^Version: //p' debian/control)
FILEVER=${VER#*:}
OUT=build/kiosk-setup_${FILEVER}
rm -rf "$OUT"; mkdir -p "$OUT/DEBIAN" dist
cp -a rootfs/. "$OUT/"
cp debian/control debian/config debian/templates debian/postrm "$OUT/DEBIAN/"
python3 - debian/postinst src "$OUT/DEBIAN/postinst" <<'PY'
import re, sys
s = open(sys.argv[1]).read(); src = sys.argv[2]
for line in open(src + "/MANIFEST"):
    line = line.strip()
    if not line or line.startswith("#"): continue
    mk, fn = line.split()
    m = re.search(r"<<'%s'\n(.*?)\n%s\n" % (mk, mk), s, re.S)
    assert m, "brak bloku " + mk
    body = open(src + "/" + fn).read().rstrip("\n")
    assert "\n%s\n" % mk not in "\n" + body + "\n", "plik %s zawiera znacznik %s" % (fn, mk)
    s = s[:m.start(1)] + body + s[m.end(1):]
open(sys.argv[3], "w").write(s)
PY
chmod 0755 "$OUT/DEBIAN/postinst" "$OUT/DEBIAN/postrm" "$OUT/DEBIAN/config"
bash -n "$OUT/DEBIAN/postinst"; bash -n "$OUT/DEBIAN/postrm"
if [ $NOPIPER = 0 ]; then
  if [ -n "$FROMDEB" ]; then
    T=$(mktemp -d); dpkg-deb -x "$FROMDEB" "$T"; mkdir -p "$OUT/opt"; cp -a "$T/opt/kiosk-piper" "$OUT/opt/"; rm -rf "$T"
  elif [ -d "$PIPER" ]; then
    mkdir -p "$OUT/opt"; cp -a "$PIPER" "$OUT/opt/kiosk-piper"
  else
    echo "Brak Pipera ($PIPER) — podaj --piper-from stary.deb albo --no-piper"; exit 1
  fi
fi
dpkg-deb --build --root-owner-group "$OUT" "dist/kiosk-setup_${FILEVER}_amd64.deb"
echo "Gotowe: dist/kiosk-setup_${FILEVER}_amd64.deb (wersja $VER)"
