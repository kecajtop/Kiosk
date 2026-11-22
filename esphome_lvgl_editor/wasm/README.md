# Prawdziwy podgląd LVGL (WebAssembly)

Zwykły podgląd w edytorze (`CanvasWidget.tsx`) rysuje widgety jako zwykłe HTML/CSS -
to tylko **przybliżenie** wyglądu LVGL (patrz 1.5.0 w CHANGELOG - poprawiono tam parę
najbardziej rzucających się w oczy różnic, ale to wciąż nie jest prawdziwy LVGL).

Ten katalog zawiera "silnik", który kompiluje **prawdziwą** bibliotekę LVGL do
WebAssembly i pozwala renderować aktualną stronę edytora przez nią, bezpośrednio w
przeglądarce użytkownika - bez instalowania czegokolwiek, bez przebudowy ESPHome.

## Jak to działa

1. `interpreter.c` - kompilowany RAZ (nie przy każdej edycji!) do WASM. W runtime
   dostaje JSON opisujący aktualne drzewo widgetów, czyści poprzednią stronę LVGL i
   buduje ją od nowa prawdziwymi wywołaniami LVGL (`lv_obj_create`, `lv_label_create`,
   `lv_obj_set_style_bg_color`, ...), po czym wymusza jedno synchroniczne odświeżenie
   (`lv_refr_now`) do bufora pikseli w pamięci WASM.
2. `src/utils/lvglPreviewSerializer.ts` - zamienia stan edytora (`LVGLConfig` + aktualna
   strona) na ten JSON.
3. `src/wasm/lvglPreview.ts` - cienki wrapper: ładuje skompilowany moduł, woła
   `lv_preview_render(json)`, odczytuje bufor z pamięci WASM (`HEAPU8`) i zamienia
   kolejność kanałów `lv_color32_t` (B,G,R,A) na RGBA, gotowe do `ImageData`.
4. `src/components/RealLvglPreview.tsx` - rysuje ten `ImageData` na `<canvas>`.

**Ważne przy modyfikacji `interpreter.c`:** `flush_cb` przekazany do
`lv_display_set_flush_cb()` MUSI wołać `lv_display_flush_ready()` (nawet jeśli nic
nie robi poza tym - nie ma tu żadnego prawdziwego transferu do poczekania na niego).
Bez tego pierwszy `lv_preview_render()` działa normalnie, ale KAŻDY następny wisi w
nieskończoność w `lv_refr_now()`/`lv_timer_handler()`, blokując cały wątek główny
przeglądarki (1.6.2 naprawiła dokładnie to - `flush_cb` było `NULL`).

Dzięki temu nie trzeba kompilować C przy każdej edycji (co trwałoby zbyt długo na
podgląd na żywo) - kompiluje się tylko generyczny "interpreter" raz, a każda zmiana
w edytorze to tylko nowy JSON + jedno wywołanie render().

## Zakres (v1)

Obsługiwane typy widgetów: `obj, label, button, bar, slider, switch, checkbox, arc,
led, dropdown, roller, textarea`. Częściowo: `line` (tylko jako pusty obiekt, bez
punktów). Jeszcze NIE obsługiwane: `meter, spinner, image, msgbox`, pełne
`buttonmatrix` (siatka przycisków) i `spinbox` (tylko tworzony, bez formatowania
cyfr/kroku).

Widgety/właściwości spoza tej listy są pomijane po cichu przez serializer (patrz
`SUPPORTED_TYPES` w `lvglPreviewSerializer.ts`) - prawdziwy podgląd wtedy pokaże
*mniej* niż zwykły CSS-owy podgląd. To znane ograniczenie v1, nie bug.

Inne ograniczenia v1:
- Brak kolorowania wskaźnika (`indicator`) baru/slidera osobno od `bg_color` -
  używany jest domyślny kolor motywu LVGL (co jest poprawne, ale może zaskakiwać
  przy porównaniu z CSS-owym podglądem).
- Czcionki ograniczone do 10 rozmiarów Montserrat wbudowanych w LVGL (12-48px,
  patrz `lv_conf.h`) - brak własnych/ikonowych fontów.
- Widok tylko do podglądu - nie da się w nim przeciągać/edytować widgetów (edycja
  zostaje w zwykłym `Canvas.tsx`).

## Przebudowa silnika

Wymaga Emscriptenu (`emcc`). **Nie instalować przez `emsdk`** - skrypt `emsdk install`
ściąga prebuildy Node/LLVM z `storage.googleapis.com`, co w środowisku agenta jest
zablokowane przez proxy (403). Zamiast tego, na Ubuntu/Debianie:

```bash
apt-get install -y emscripten
```

Potem:

```bash
cd wasm
./fetch_vendor.sh   # ściąga LVGL release/v9.1 + cJSON do vendor/ (poza gitem)
./build.sh          # kompiluje do dist/lvgl_preview.js
cp dist/lvgl_preview.js ../src/wasm/lvgl_preview.js
```

`dist/lvgl_preview.js` (i jego kopia w `src/wasm/`) **są** commitowane do repo -
to jeden plik ~900K (build flag `SINGLE_FILE=1` koduje WASM jako base64 wewnątrz
JS), więc shipowany addon nie potrzebuje Emscriptenu w swoim pipeline - skompilowany
moduł działa w zwykłej przeglądarce końcowego użytkownika.

`wasm/vendor/` (ściągane źródło LVGL + cJSON, ~22M) jest w `.gitignore` - nie jest
częścią repo, odtwarza się je przez `./fetch_vendor.sh`.

### `lv_conf.h`

Wygenerowany z `vendor/lvgl/lv_conf_template.h` z trzema zmianami:
- `#if 0` -> `#if 1` (aktywuje cały plik)
- `LV_COLOR_DEPTH 16` -> `32` (natywny format `ARGB8888`, bezpośrednio pasujący do
  pikseli canvasa, bez dodatkowej konwersji 16->32 bit)
- `LV_FONT_MONTSERRAT_{12,16,20,24,28,32,36,40,48}` z `0` na `1` (plus domyślnie
  włączony rozmiar 14) - żeby `interpreter.c` miał z czego wybierać dla `text_font`.

Jeśli zmienia się coś w `lv_conf.h` ręcznie po `fetch_vendor.sh` (bo skrypt kopiuje
template na nowo), pamiętaj o ponownym zaaplikowaniu tych trzech zmian.
