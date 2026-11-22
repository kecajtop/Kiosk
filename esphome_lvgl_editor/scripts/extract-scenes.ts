// Diagnostic helper: parses a real ESPHome device YAML the same way the editor
// does and dumps the "Prawdziwy LVGL" JSON scene for every page to disk — no
// browser needed. Useful when the real-LVGL preview looks wrong (or, as
// happened once, hangs) for a specific project: run this first to see exactly
// what JSON the C interpreter would receive for each page, without having to
// click through the whole app.
//
// Usage: npx tsc scripts/extract-scenes.ts --module commonjs --target es2020 \
//          --esModuleInterop --skipLibCheck --outDir .tmp-extract
//        node .tmp-extract/scripts/extract-scenes.js <device.yaml> <out-dir>
declare function require(name: string): any;
declare const process: any;
declare const global: any;

// Minimal DOM stub so fontRegistry.ts's `injectLink()` (which just appends a
// <link> tag for web fonts - irrelevant to this diagnostic script) doesn't
// throw under plain Node, which has no `document`.
const fakeCanvasContext = {
  font: '',
  measureText: (text: string) => ({
    width: text.length * 8,
    actualBoundingBoxAscent: 10,
    actualBoundingBoxDescent: 3,
  }),
};
global.document = {
  createElement: (tag: string) =>
    tag === 'canvas' ? { getContext: () => fakeCanvasContext } : {},
  head: { appendChild: () => {} },
};

const fs = require('fs');

import { parseFullESPHomeFile } from '../src/utils/yamlConverter';
import { serializePageForPreview } from '../src/utils/lvglPreviewSerializer';

const yamlPath = process.argv[2];
const outDir = process.argv[3];
const yamlText = fs.readFileSync(yamlPath, 'utf-8');

console.log('Parsing...');
const t0 = Date.now();
const result = parseFullESPHomeFile(yamlText);
console.log(`Parsed in ${Date.now() - t0}ms. isFullFile=${result.isFullFile}, issues=${result.issues.length}`);

const config = result.lvglConfig;
console.log(`Pages: ${config.pages.map(p => p.id).join(', ')}`);

for (const page of config.pages) {
  const t1 = Date.now();
  const scene = serializePageForPreview(config, page.id);
  const dt = Date.now() - t1;
  console.log(`  serialize ${page.id}: ${dt}ms, widgets=${scene.widgets.length}`);
  fs.writeFileSync(`${outDir}/scene_${page.id}.json`, JSON.stringify(scene, null, 2));
}
console.log('Done.');
