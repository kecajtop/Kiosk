// Cienki wrapper na skompilowany "silnik" prawdziwego LVGL (patrz wasm/README.md w korzeniu
// repo tego dodatku — tam jest pełny opis architektury, zakresu i instrukcja przebudowy).
// lvgl_preview.js to zwykły plik wygenerowany przez Emscripten (brak własnych typów), stąd
// `// @ts-ignore` tylko na imporcie.
// @ts-ignore
import createLvglPreviewModule from './lvgl_preview.js';
import type { PreviewScene } from '../utils/lvglPreviewSerializer';

interface WasmModule {
  ccall: (name: string, returnType: string | null, argTypes: string[], args: any[]) => any;
  HEAPU8: Uint8Array;
}

let modulePromise: Promise<WasmModule> | null = null;
let initializedSize: { width: number; height: number } | null = null;

function getModule(): Promise<WasmModule> {
  if (!modulePromise) {
    modulePromise = createLvglPreviewModule() as Promise<WasmModule>;
  }
  return modulePromise;
}

/**
 * Renderuje scenę (patrz lvglPreviewSerializer.ts) przez prawdziwy LVGL i zwraca RGBA
 * gotowe do `ImageData`/`putImageData`. LVGL trzyma piksele jako B,G,R,A (lv_color32_t) —
 * zamiana kolejności na R,G,B,A robiona jest tutaj, więc wywołujący dostaje już gotowy RGBA.
 */
export async function renderLvglScene(
  width: number,
  height: number,
  scene: PreviewScene
): Promise<Uint8ClampedArray> {
  const mod = await getModule();

  if (!initializedSize || initializedSize.width !== width || initializedSize.height !== height) {
    mod.ccall('lv_preview_init', null, ['number', 'number'], [width, height]);
    initializedSize = { width, height };
  }

  mod.ccall('lv_preview_render', null, ['string'], [JSON.stringify(scene)]);

  const ptr = mod.ccall('lv_preview_get_buffer', 'number', [], []);
  const size = mod.ccall('lv_preview_get_buffer_size', 'number', [], []);
  const bgra = mod.HEAPU8.subarray(ptr, ptr + size);

  const rgba = new Uint8ClampedArray(size);
  for (let i = 0; i < size; i += 4) {
    rgba[i] = bgra[i + 2];     // R
    rgba[i + 1] = bgra[i + 1]; // G
    rgba[i + 2] = bgra[i];     // B
    rgba[i + 3] = bgra[i + 3]; // A
  }
  return rgba;
}
