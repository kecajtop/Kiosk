#!/usr/bin/env bash
# Buduje "silnik" prawdziwego podglądu LVGL do WebAssembly. Wymaga wcześniejszego
# ./fetch_vendor.sh (ściąga przypiętą wersję LVGL + cJSON do wasm/vendor/, pominięte z gita).
#
# Wynik: wasm/dist/lvgl_preview.js - jeden plik (SINGLE_FILE=1, kod WASM zakodowany jako
# base64 wewnątrz JS), ładowany jako moduł ESM (MODULARIZE=1 + EXPORT_ES6=1) z src/.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d vendor/lvgl ] || [ ! -f vendor/cJSON.c ]; then
  echo "Brak wasm/vendor/ - uruchom najpierw ./fetch_vendor.sh" >&2
  exit 1
fi

mkdir -p dist

LVGL_SRC=$(find vendor/lvgl/src -name '*.c')

emcc \
  interpreter.c \
  vendor/cJSON.c \
  $LVGL_SRC \
  -I. \
  -Ivendor/lvgl \
  -Ivendor \
  -O2 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME=createLvglPreviewModule \
  -s SINGLE_FILE=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS=_lv_preview_init,_lv_preview_render,_lv_preview_get_buffer,_lv_preview_get_buffer_size,_malloc,_free \
  -s EXPORTED_RUNTIME_METHODS=ccall,cwrap,HEAPU8 \
  -o dist/lvgl_preview.js

echo "OK -> wasm/dist/lvgl_preview.js ($(du -h dist/lvgl_preview.js | cut -f1))"
