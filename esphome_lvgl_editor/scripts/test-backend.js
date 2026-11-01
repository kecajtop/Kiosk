// Integration test for server/index.js: runs the real HTTP server against a
// scratch copy of the fixture files and checks the file API never corrupts,
// loses, or lets you escape the configured ESPHome directory.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const PORT = 18099 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
const fail = (label, detail) => {
  failures += 1;
  console.error(`FAIL  ${label}\n      ${detail}`);
};
const pass = (label) => console.log(`PASS  ${label}`);

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(BASE + urlPath, { method }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* not JSON, e.g. static asset */ }
        resolve({ status: res.statusCode, body: data, json });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function main() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lvgl-editor-test-'));
  const esphomeDir = path.join(tmpRoot, 'esphome');
  fs.mkdirSync(esphomeDir, { recursive: true });

  const fixturesDir = path.join(__dirname, 'fixtures');
  for (const file of fs.readdirSync(fixturesDir)) {
    fs.copyFileSync(path.join(fixturesDir, file), path.join(esphomeDir, file));
  }
  // A file outside the esphome dir — must never be reachable through the API.
  fs.writeFileSync(path.join(tmpRoot, 'secret.yaml'), 'top: secret\n');

  process.env.ESPHOME_DIR = esphomeDir;
  process.env.PORT = String(PORT);
  delete require.cache[require.resolve('../server/index.js')];
  require('../server/index.js');
  await new Promise((r) => setTimeout(r, 300));

  // ---- listing ----
  const list = await request('GET', '/api/esphome/files');
  if (list.status !== 200) fail('list: status', `expected 200, got ${list.status}`);
  const names = (list.json.files || []).map((f) => f.path).sort();
  const expected = fs.readdirSync(fixturesDir).sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    fail('list: file set', `expected ${JSON.stringify(expected)}, got ${JSON.stringify(names)}`);
  } else {
    pass('list: returns exactly the fixture files');
  }
  const nspanelEntry = (list.json.files || []).find((f) => f.path === 'basic-nspanel.yaml');
  if (!nspanelEntry || nspanelEntry.hasLvgl !== true) {
    fail('list: hasLvgl flag', 'basic-nspanel.yaml should be flagged hasLvgl: true');
  } else {
    pass('list: hasLvgl flag set correctly');
  }

  // ---- read ----
  const original = fs.readFileSync(path.join(esphomeDir, 'basic-nspanel.yaml'), 'utf8');
  const read = await request('GET', '/api/esphome/file/basic-nspanel.yaml');
  if (read.status !== 200 || read.json.content !== original) {
    fail('read: content matches disk', `status=${read.status}`);
  } else {
    pass('read: returns exact file content');
  }

  // ---- path traversal / hidden-path rejection ----
  const traversal = await request('GET', '/api/esphome/file/%2e%2e%2fsecret.yaml');
  if (traversal.status !== 400) fail('read: traversal rejected', `expected 400, got ${traversal.status}`);
  else pass('read: rejects path traversal (../secret.yaml)');

  const hiddenPut = await request('PUT', '/api/esphome/file/.lvgl_editor_backups/x.yaml', 'x: 1\n');
  if (hiddenPut.status !== 400 && hiddenPut.status !== 404) {
    fail('write: hidden path rejected', `expected 400/404, got ${hiddenPut.status}`);
  } else {
    pass('write: rejects writing into the backups folder');
  }

  // ---- write: happy path, atomic + backup ----
  const edited = original.replace('Living Room', 'Living Room (edited)');
  const write1 = await request('PUT', '/api/esphome/file/basic-nspanel.yaml', edited);
  if (write1.status !== 200) fail('write: happy path status', `expected 200, got ${write1.status}: ${write1.body}`);
  const onDiskAfterWrite1 = fs.readFileSync(path.join(esphomeDir, 'basic-nspanel.yaml'), 'utf8');
  if (onDiskAfterWrite1 !== edited) fail('write: content persisted', 'file on disk does not match what was PUT');
  else pass('write: content persisted exactly as sent');

  const backupDir = path.join(esphomeDir, '.lvgl_editor_backups', 'basic-nspanel.yaml');
  if (!fs.existsSync(backupDir)) {
    fail('write: backup created', `expected backup dir at ${backupDir}`);
  } else {
    const backups = fs.readdirSync(backupDir);
    if (backups.length !== 1) {
      fail('write: backup count after 1 save', `expected 1, got ${backups.length}`);
    } else {
      const backupContent = fs.readFileSync(path.join(backupDir, backups[0]), 'utf8');
      if (backupContent !== original) fail('write: backup content', 'backup does not match pre-edit original');
      else pass('write: backup preserves the pre-edit content');
    }
  }
  if (!fs.existsSync(path.join(esphomeDir, 'basic-nspanel.yaml') + '.tmp-leftover-check')) {
    pass('write: no leftover temp file from the atomic write');
  }

  // ---- backup rotation: keep only last 5 ----
  for (let i = 0; i < 6; i++) {
    await request('PUT', '/api/esphome/file/basic-nspanel.yaml', edited + `\n# rev ${i}\n`);
  }
  const backupsAfterMany = fs.readdirSync(backupDir);
  if (backupsAfterMany.length !== 5) {
    fail('write: backup rotation', `expected 5 backups kept, got ${backupsAfterMany.length}`);
  } else {
    pass('write: backup rotation keeps only the last 5');
  }

  // ---- write: refuses empty body, file untouched ----
  const beforeEmptyAttempt = fs.readFileSync(path.join(esphomeDir, 'basic-nspanel.yaml'), 'utf8');
  const emptyWrite = await request('PUT', '/api/esphome/file/basic-nspanel.yaml', '   \n  ');
  if (emptyWrite.status !== 400) fail('write: empty body rejected', `expected 400, got ${emptyWrite.status}`);
  else pass('write: rejects empty content');
  const afterEmptyAttempt = fs.readFileSync(path.join(esphomeDir, 'basic-nspanel.yaml'), 'utf8');
  if (afterEmptyAttempt !== beforeEmptyAttempt) fail('write: empty body left file untouched', 'file changed despite rejected write');
  else pass('write: file on disk untouched after a rejected empty write');

  // ---- write: 404 for a file that was never there, directory untouched ----
  const nonexistentPut = await request('PUT', '/api/esphome/file/does-not-exist.yaml', 'pages: []\n');
  if (nonexistentPut.status !== 404) fail('write: 404 for new file', `expected 404, got ${nonexistentPut.status}`);
  else pass('write: refuses to create a brand-new file via the editor');
  if (fs.existsSync(path.join(esphomeDir, 'does-not-exist.yaml'))) {
    fail('write: no file created', 'a file was created despite the 404');
  }

  // ---- conflict scenario: another process (e.g. the ESPHome add-on) edits the file ----
  const beforeExternalEdit = await request('GET', '/api/esphome/file/meter-keypad.yaml');
  fs.writeFileSync(path.join(esphomeDir, 'meter-keypad.yaml'), beforeExternalEdit.json.content + '\n# edited by another add-on\n');
  const afterExternalEdit = await request('GET', '/api/esphome/file/meter-keypad.yaml');
  if (afterExternalEdit.json.content === beforeExternalEdit.json.content) {
    fail('conflict: server reflects external edits', 'GET still returned the stale content the client had cached');
  } else {
    pass('conflict: GET always returns the live file, so the editor can detect an external edit before saving');
  }

  console.log('');
  if (failures > 0) {
    console.error(`${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('All backend integration checks passed.');
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}

main().catch((e) => {
  console.error('Test harness crashed:', e);
  process.exit(1);
});
