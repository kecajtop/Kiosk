#!/bin/bash
# Buduje kiosk-setup_<wersja>_amd64.deb ze źródeł w tym katalogu.
#
#   ./build.sh                      – Piper (TTS) z katalogu ./piper albo $PIPER_DIR
#   ./build.sh --piper-from X.deb   – Piper wyciągnięty z wcześniejszego pakietu kiosk-setup
#   ./build.sh --no-piper           – bez Pipera (komunikaty głosowe tylko espeak-ng)
#   ./build.sh --light              – wersja light (pakiet kiosk-setup-light): ekran, Chromium, kamery
#                                     RTSP, panel WWW, MQTT/HA i muzyka; bez mowy, interkomu i asystenta
#
# Skrypty z src/ są wklejane do debian/postinst w miejsce bloków heredoc
# wymienionych w src/MANIFEST, więc edytuje się tylko pliki w src/.
set -euo pipefail
cd "$(dirname "$0")"
PIPER="${PIPER_DIR:-piper}"; FROMDEB=""; NOPIPER=0; LIGHT=0
while [ $# -gt 0 ]; do case "$1" in
  --piper-from) FROMDEB="$2"; shift 2;;
  --no-piper) NOPIPER=1; shift;;
  --light) LIGHT=1; NOPIPER=1; shift;;
  *) echo "nieznana opcja: $1"; exit 2;;
esac; done
VER=$(sed -n 's/^Version: //p' debian/control)
FILEVER=${VER#*:}
PKG=kiosk-setup; [ $LIGHT = 1 ] && PKG=kiosk-setup-light
OUT=build/${PKG}_${FILEVER}
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
if [ $LIGHT = 1 ]; then
  # Wersja light: inny pakiet, bez zależności mowy, bez głosów Piper; znacznik dla kiosk-api.
  python3 - "$OUT/DEBIAN" <<'PY'
import re, sys
d = sys.argv[1]
c = open(d + "/control").read()
c = c.replace("Package: kiosk-setup\n", "Package: kiosk-setup-light\n")
c = re.sub(r"^Depends: .*$", lambda m: m.group(0).replace(" espeak-ng,", ""), c, flags=re.M)
c = re.sub(r"^Recommends: .*$", "Recommends: gmediarender, ddcutil", c, flags=re.M)
c = re.sub(r"^Conflicts: .*\n|^Replaces: .*\n", "", c, flags=re.M)
c = c.replace("Suggests:", "Conflicts: kiosk-setup\nReplaces: kiosk-setup\nSuggests:", 1)
c = re.sub(r"^(Description: .*)$", r"\1 — wersja light (bez mowy)", c, count=1, flags=re.M)
open(d + "/control", "w").write(c)
p = open(d + "/postinst").read()
a = p.index('echo "==> Głosy Piper'); b = p.index('echo "==> Wyłączanie ekranu')
p = p[:a] + ('echo "==> Wersja light: bez mowy (głosy Piper, czytanie komunikatów i asystent głosowy pominięte)..."\n'
             'rm -f /usr/local/sbin/kiosk-voice\n'
             'VOICE_SUMMARY="brak — wersja light (muzyka i radio działają, mowy nie ma)"\n\n') + p[b:]
p = re.sub(r"dpkg-reconfigure kiosk-setup(?!-light)", "dpkg-reconfigure kiosk-setup-light", p)
open(d + "/postinst", "w").write(p)
for f in ("templates", "config"):
    t = open(d + "/" + f).read()
    open(d + "/" + f, "w").write(re.sub(r"dpkg-reconfigure kiosk-setup(?!-light)", "dpkg-reconfigure kiosk-setup-light", t))
PY
  mkdir -p "$OUT/usr/share/kiosk-setup"
  echo "kiosk-setup-light: bez mowy (TTS), interkomu i asystenta głosowego" > "$OUT/usr/share/kiosk-setup/light"
fi
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
bash -n "$OUT/DEBIAN/postinst"
dpkg-deb --build --root-owner-group "$OUT" "dist/${PKG}_${FILEVER}_amd64.deb"
echo "Gotowe: dist/${PKG}_${FILEVER}_amd64.deb (wersja $VER)"
