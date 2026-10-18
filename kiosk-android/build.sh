#!/bin/bash
# Buduje aplikację Kiosk na Androida (APK) bez Gradle i Android Studio — narzędzia z Ubuntu:
#   sudo apt install openjdk-17-jdk-headless aapt dalvik-exchange zipalign apksigner android-sdk-platform-23
#   KEYSTORE=~/kiosk-android.keystore ./build.sh     -> dist/kiosk-android.apk
# Klucz podpisu (KEYSTORE, hasło w KEYSTORE_PASS) musi być ten sam przy każdej wersji —
# inaczej Android nie zainstaluje aktualizacji na starą wersję. Brak pliku = nowy klucz.
set -euo pipefail
cd "$(dirname "$0")"
SDK=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
KEYSTORE=${KEYSTORE:-$HOME/kiosk-android.keystore}
KEYSTORE_PASS=${KEYSTORE_PASS:-kiosk-android}
OUT=build
VER=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' AndroidManifest.xml)
for t in javac aapt dalvik-exchange zipalign apksigner keytool; do
    command -v $t >/dev/null || { echo "Brak narzędzia: $t (patrz nagłówek skryptu)"; exit 1; }
done
[ -f "$SDK" ] || { echo "Brak $SDK (pakiet android-sdk-platform-23)"; exit 1; }
rm -rf "$OUT"; mkdir -p "$OUT/obj" "$OUT/dex" dist

echo "==> javac"
javac -encoding UTF-8 --release 8 -Xlint:-options -nowarn -cp "$SDK" -d "$OUT/obj" $(find src -name '*.java')
echo "==> dex"
dalvik-exchange --dex --min-sdk-version=21 --output="$OUT/dex/classes.dex" "$OUT/obj"
echo "==> aapt (zasoby, manifest)"
aapt package -f -M AndroidManifest.xml -S res -I "$SDK" -F "$OUT/app.unsigned.apk"
(cd "$OUT/dex" && aapt add ../app.unsigned.apk classes.dex >/dev/null)
echo "==> zipalign"
zipalign -f -p 4 "$OUT/app.unsigned.apk" "$OUT/app.aligned.apk"
if [ ! -f "$KEYSTORE" ]; then
    echo "==> nowy klucz podpisu: $KEYSTORE (zachowaj go — potrzebny do aktualizacji aplikacji)"
    keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASS" -keypass "$KEYSTORE_PASS" \
        -alias kiosk -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=kecajtop Kiosk, O=kecaj" >/dev/null 2>&1
fi
echo "==> apksigner"
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KEYSTORE_PASS" --ks-key-alias kiosk \
    --min-sdk-version 21 --out "dist/kiosk-android-$VER.apk" "$OUT/app.aligned.apk"
apksigner verify --min-sdk-version 21 "dist/kiosk-android-$VER.apk"
echo "Gotowe: dist/kiosk-android-$VER.apk ($(du -k "dist/kiosk-android-$VER.apk" | cut -f1) kB)"
