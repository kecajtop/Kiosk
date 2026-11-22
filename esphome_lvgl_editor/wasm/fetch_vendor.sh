#!/usr/bin/env bash
# Ściąga do wasm/vendor/ (pominięte z gita - patrz .gitignore) dokładnie przypięte wersje:
#  - LVGL (release/v9.1, konkretny commit poniżej - nie "najnowszy v9.1", żeby build był
#    odtwarzalny nawet jeśli branch release/v9.1 pojedzie dalej)
#  - cJSON (do parsowania JSON-owej "scene" przysyłanej z JS, patrz interpreter.c)
#
# Użycie: ./fetch_vendor.sh && ./build.sh
set -euo pipefail
cd "$(dirname "$0")"

# Przypięty commit na branchu release/v9.1 (LVGL 9.1.0), potwierdzony przez
# vendor/lvgl/lvgl.h -> LVGL_VERSION_MAJOR/MINOR/PATCH w czasie pisania tego skryptu.
LVGL_COMMIT=0b09f5866d4a9251e3509acc3c44e794d4225002
CJSON_REPO=https://github.com/DaveGamble/cJSON.git

rm -rf vendor
mkdir -p vendor

echo "==> Ściąganie LVGL (release/v9.1 @ ${LVGL_COMMIT})..."
git clone --depth 1 --branch release/v9.1 https://github.com/lvgl/lvgl.git vendor/lvgl
(
  cd vendor/lvgl
  actual_commit=$(git rev-parse HEAD)
  if [ "$actual_commit" != "$LVGL_COMMIT" ]; then
    echo "UWAGA: branch release/v9.1 wskazuje teraz na ${actual_commit}, nie na przypięty ${LVGL_COMMIT}." >&2
    echo "       Build będzie kontynuowany, ale wynik może się różnić od tego, co było testowane." >&2
  fi
)
# Zostaw tylko to, co faktycznie potrzebne do kompilacji (src/ + lv_conf_template.h + lvgl.h) -
# dokumentacja/przykłady/demos/testy to tylko zbędne megabajty.
rm -rf vendor/lvgl/.git vendor/lvgl/docs vendor/lvgl/examples vendor/lvgl/demos \
       vendor/lvgl/tests vendor/lvgl/env_support

echo "==> Ściąganie cJSON..."
git clone --depth 1 "$CJSON_REPO" vendor/cjson_tmp
cp vendor/cjson_tmp/cJSON.c vendor/cJSON.c
cp vendor/cjson_tmp/cJSON.h vendor/cJSON.h
rm -rf vendor/cjson_tmp

echo "OK - wasm/vendor/ gotowe. Teraz: ./build.sh"
