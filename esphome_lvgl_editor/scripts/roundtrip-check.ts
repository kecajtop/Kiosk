declare function require(name: string): any;
declare const process: any;

const fs = require('fs');
const path = require('path');
import yaml from 'js-yaml';
import { configToPagesYaml, parseFullESPHomeFile, reconstructFullESPHomeYaml } from '../src/utils/yamlConverter';

const espHomeTypes = [
  new yaml.Type('!secret', { kind: 'scalar', construct: (d: any) => `!secret ${d}` }),
  new yaml.Type('!include', { kind: 'scalar', construct: (d: any) => `!include ${d}` }),
  new yaml.Type('!lambda', { kind: 'scalar', construct: (d: any) => d }),
  new yaml.Type('!extend', { kind: 'scalar', construct: (d: any) => `!extend ${d}` }),
];

const ESP_HOME_SCHEMA = (yaml.DEFAULT_SCHEMA as any).extend(espHomeTypes);

const filePath = process.argv[2];
const outputPath = process.argv[3];
if (!filePath) {
  console.error('Usage: node roundtrip-check.js <yaml-file>');
  process.exit(1);
}

const raw = fs.readFileSync(filePath, 'utf8');
const importResult = parseFullESPHomeFile(raw);
const output = importResult.isFullFile
  ? reconstructFullESPHomeYaml(raw, importResult.lvglConfig)
  : configToPagesYaml(importResult.lvglConfig);

if (outputPath) {
  fs.writeFileSync(outputPath, output, 'utf8');
}

const normalize = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = normalize(value[key]);
        return acc;
      }, {});
  }
  return value;
};

const rawParsed = yaml.load(raw, { schema: ESP_HOME_SCHEMA });
const outputParsed = yaml.load(output, { schema: ESP_HOME_SCHEMA });
const semanticEqual = JSON.stringify(normalize(rawParsed)) === JSON.stringify(normalize(outputParsed));
const exactEqual = raw === output;

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

  if (left && typeof left === 'object' || right && typeof right === 'object') {
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

const firstSemanticDiff = findFirstSemanticDiff(rawParsed, outputParsed);

const rawLines = raw.split(/\r?\n/);
const outputLines = output.split(/\r?\n/);
let firstDiffLine = -1;
for (let index = 0; index < Math.max(rawLines.length, outputLines.length); index += 1) {
  if (rawLines[index] !== outputLines[index]) {
    firstDiffLine = index + 1;
    break;
  }
}

console.log(JSON.stringify({
  filePath: path.resolve(filePath),
  isFullFile: importResult.isFullFile,
  exactEqual,
  semanticEqual,
  inputLength: raw.length,
  outputLength: output.length,
  inputLines: rawLines.length,
  outputLines: outputLines.length,
  firstDiffLine,
  firstInputLine: firstDiffLine === -1 ? null : rawLines[firstDiffLine - 1],
  firstOutputLine: firstDiffLine === -1 ? null : outputLines[firstDiffLine - 1],
  firstSemanticDiff,
}, null, 2));