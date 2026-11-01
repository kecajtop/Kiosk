// Round-trip safety test for the ESPHome <-> LVGL editor conversion.
//
// For every fixture under scripts/fixtures/*.yaml, this checks that:
//  1. parsing a full ESPHome device file never throws and is recognised as such
//  2. reconstructing it UNCHANGED reproduces the original byte-for-byte outside
//     the lvgl: block, and is semantically identical YAML overall
//  3. validateReconstruction() accepts that unchanged round trip
//  4. simulating an in-editor EDIT (adding a widget) still leaves every
//     non-lvgl section byte-for-byte identical to the original file, and the
//     new widget shows up in the output
//  5. CRLF line endings in the source file don't break extraction/reconstruction
//
// This is what stands behind the "the editor must never destroy a real
// device's YAML file" requirement — run before every release.
declare function require(name: string): any;
declare const process: any;

const fs = require('fs');
const path = require('path');
import yaml from 'js-yaml';
import {
  parseFullESPHomeFile,
  reconstructFullESPHomeYaml,
  validateReconstruction,
  extractLvglSection,
} from '../src/utils/yamlConverter';
import { Widget } from '../src/types/widgets';

const espHomeTypes = [
  new yaml.Type('!secret', { kind: 'scalar', construct: (d: any) => `!secret ${d}` }),
  new yaml.Type('!include', { kind: 'scalar', construct: (d: any) => `!include ${d}` }),
  new yaml.Type('!lambda', { kind: 'scalar', construct: (d: any) => d }),
  new yaml.Type('!extend', { kind: 'scalar', construct: (d: any) => `!extend ${d}` }),
];
const ESP_HOME_SCHEMA = (yaml.DEFAULT_SCHEMA as any).extend(espHomeTypes);

const normalize = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc: Record<string, any>, key) => {
      acc[key] = normalize(value[key]);
      return acc;
    }, {});
  }
  return value;
};

const outsideLvgl = (raw: string): string => {
  const { startLine, endLine } = extractLvglSection(raw);
  if (startLine === -1) return raw;
  const lines = raw.split('\n');
  return lines.slice(0, startLine).join('\n') + '\n<<<LVGL BLOCK>>>\n' + lines.slice(endLine).join('\n');
};

const findFirstSemanticDiff = (left: any, right: any, currentPath = '$'): { path: string; left: any; right: any } | null => {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return { path: currentPath, left, right };
    if (left.length !== right.length) return { path: `${currentPath}.length`, left: left.length, right: right.length };
    for (let index = 0; index < left.length; index += 1) {
      const diff = findFirstSemanticDiff(left[index], right[index], `${currentPath}[${index}]`);
      if (diff) return diff;
    }
    return null;
  }
  if ((left && typeof left === 'object') || (right && typeof right === 'object')) {
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return { path: currentPath, left, right };
    const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
    for (const key of keys) {
      if (!(key in left) || !(key in right)) return { path: `${currentPath}.${key}`, left: left[key], right: right[key] };
      const diff = findFirstSemanticDiff(left[key], right[key], `${currentPath}.${key}`);
      if (diff) return diff;
    }
    return null;
  }
  if (left !== right) return { path: currentPath, left, right };
  return null;
};

let failures = 0;
const fail = (label: string, detail: string) => {
  failures += 1;
  console.error(`FAIL  ${label}\n      ${detail}`);
};
const pass = (label: string) => console.log(`PASS  ${label}`);

const fixturesDir = path.join(process.cwd(), 'scripts', 'fixtures');
const fixtureFiles = fs.readdirSync(fixturesDir).filter((f: string) => /\.ya?ml$/i.test(f));

if (fixtureFiles.length === 0) {
  console.error(`No fixtures found in ${fixturesDir}`);
  process.exit(1);
}

for (const file of fixtureFiles) {
  const fixturePath = path.join(fixturesDir, file);
  const raw = fs.readFileSync(fixturePath, 'utf8');

  // ---- 1 & 2 & 3: unchanged round trip ----
  let result;
  try {
    result = parseFullESPHomeFile(raw);
  } catch (e) {
    fail(`${file}: parse`, String(e));
    continue;
  }
  if (!result.isFullFile) {
    fail(`${file}: isFullFile`, 'Expected a full ESPHome device file to be detected as such');
    continue;
  }
  pass(`${file}: parses as full ESPHome file`);

  let unchangedOutput: string;
  try {
    unchangedOutput = reconstructFullESPHomeYaml(raw, result.lvglConfig);
  } catch (e) {
    fail(`${file}: reconstruct (unchanged)`, String(e));
    continue;
  }

  if (outsideLvgl(raw) !== outsideLvgl(unchangedOutput)) {
    fail(`${file}: non-lvgl sections preserved`, 'Content outside lvgl: changed on an unchanged round trip');
  } else {
    pass(`${file}: non-lvgl sections byte-identical (unchanged round trip)`);
  }

  try {
    const rawParsed = yaml.load(raw, { schema: ESP_HOME_SCHEMA });
    const outParsed = yaml.load(unchangedOutput, { schema: ESP_HOME_SCHEMA });
    if (JSON.stringify(normalize(rawParsed)) !== JSON.stringify(normalize(outParsed))) {
      const diff = findFirstSemanticDiff(normalize(rawParsed), normalize(outParsed));
      fail(`${file}: semantic equality`, 'Parsed YAML differs between original and unchanged round trip: ' + JSON.stringify(diff));
    } else {
      pass(`${file}: semantically equal YAML (unchanged round trip)`);
    }
  } catch (e) {
    fail(`${file}: semantic equality parse`, String(e));
  }

  const unchangedValidation = validateReconstruction(raw, unchangedOutput);
  if (!unchangedValidation.ok) {
    fail(`${file}: validateReconstruction (unchanged)`, unchangedValidation.error || 'unknown');
  } else {
    pass(`${file}: validateReconstruction accepts unchanged round trip`);
  }

  // ---- 4: simulated edit must not touch anything outside lvgl: ----
  const editedConfig = JSON.parse(JSON.stringify(result.lvglConfig));
  const injected: Widget = { type: 'label', id: 'injected_test_label', text: 'EDITED BY TEST', x: 1, y: 1 } as Widget;
  editedConfig.pages[0].widgets.push(injected);

  let editedOutput: string;
  try {
    editedOutput = reconstructFullESPHomeYaml(raw, editedConfig);
  } catch (e) {
    fail(`${file}: reconstruct (edited)`, String(e));
    continue;
  }

  if (outsideLvgl(raw) !== outsideLvgl(editedOutput)) {
    fail(`${file}: non-lvgl sections preserved after edit`, 'Editing a widget touched content outside lvgl:');
  } else {
    pass(`${file}: non-lvgl sections byte-identical after a widget edit`);
  }

  if (!editedOutput.includes('injected_test_label') || !editedOutput.includes('EDITED BY TEST')) {
    fail(`${file}: edit applied`, 'Injected widget/text not found in reconstructed output');
  } else {
    pass(`${file}: edited widget present in output`);
  }

  const editedValidation = validateReconstruction(raw, editedOutput);
  if (!editedValidation.ok) {
    fail(`${file}: validateReconstruction (edited)`, editedValidation.error || 'unknown');
  } else {
    pass(`${file}: validateReconstruction accepts edited round trip`);
  }

  // ---- 5: CRLF line endings must not break extraction/reconstruction ----
  const crlfRaw = raw.replace(/\n/g, '\r\n');
  try {
    const crlfResult = parseFullESPHomeFile(crlfRaw);
    const crlfOutput = reconstructFullESPHomeYaml(crlfRaw, crlfResult.lvglConfig);
    const crlfValidation = validateReconstruction(crlfRaw, crlfOutput);
    if (!crlfValidation.ok) {
      fail(`${file}: CRLF round trip`, crlfValidation.error || 'unknown');
    } else {
      pass(`${file}: survives CRLF line endings`);
    }
  } catch (e) {
    fail(`${file}: CRLF round trip`, String(e));
  }
}

// ---- Guard against a corrupt/truncated reconstruction ever being accepted ----
{
  const original = fs.readFileSync(path.join(fixturesDir, fixtureFiles[0]), 'utf8');
  const truncated = original.slice(0, Math.floor(original.length / 4));
  const v1 = validateReconstruction(original, truncated);
  if (v1.ok) fail('safety net: truncated output', 'validateReconstruction accepted a quarter-length output');
  else pass('safety net: rejects a truncated/corrupted reconstruction');

  const notYaml = '{{{ not: valid: yaml ::: [[[';
  const v2 = validateReconstruction(original, notYaml);
  if (v2.ok) fail('safety net: invalid YAML', 'validateReconstruction accepted non-YAML output');
  else pass('safety net: rejects invalid YAML');

  const droppedSection = original.replace(/^wifi:[\s\S]*?(?=\n\w)/m, '');
  const v3 = validateReconstruction(original, droppedSection);
  if (v3.ok) fail('safety net: dropped section', 'validateReconstruction accepted output missing a top-level section');
  else pass('safety net: rejects output that drops a top-level section');
}

console.log('');
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log('All fixture round-trip checks passed.');
}
