// Minimal dependency-free HTTP server for the add-on:
//  - serves the built SPA from ../dist
//  - exposes a small file API so the editor can open/save ESPHome YAML
//    files straight from the Home Assistant "esphome" config folder.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8099;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function readAddonOptions() {
  try {
    return JSON.parse(fs.readFileSync('/data/options.json', 'utf8'));
  } catch {
    return {};
  }
}

const addonOptions = readAddonOptions();
const ESPHOME_DIR = path.resolve(
  addonOptions.esphome_path || process.env.ESPHOME_DIR || '/homeassistant/esphome'
);

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.map': 'application/json'
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// Resolves a relative path against ESPHOME_DIR and rejects anything that
// would escape it (e.g. `../../etc/passwd`).
function safeResolve(relPath) {
  if (!relPath || relPath.includes('\0')) return null;
  const full = path.resolve(ESPHOME_DIR, relPath);
  if (full !== ESPHOME_DIR && !full.startsWith(ESPHOME_DIR + path.sep)) return null;
  return full;
}

function listYamlFiles(dir, base, depth) {
  const results = [];
  if (depth > 8) return results;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...listYamlFiles(full, rel, depth + 1));
    } else if (/\.ya?ml$/i.test(entry.name)) {
      let size = 0;
      let hasLvgl = false;
      try {
        const stat = fs.statSync(full);
        size = stat.size;
        if (size < 2 * 1024 * 1024) {
          const content = fs.readFileSync(full, 'utf8');
          hasLvgl = /^\s*lvgl:\s*$/m.test(content);
        }
      } catch { /* unreadable file, still list it */ }
      results.push({ path: rel.split(path.sep).join('/'), size, hasLvgl });
    }
  }
  return results;
}

function handleListFiles(res) {
  if (!fs.existsSync(ESPHOME_DIR)) {
    return sendJson(res, 500, {
      error: `ESPHome directory not found: ${ESPHOME_DIR}. Check the add-on's "esphome_path" option ` +
        'and that it has access to the Home Assistant config (map: homeassistant_config).'
    });
  }
  const files = listYamlFiles(ESPHOME_DIR, '', 0)
    .sort((a, b) => (Number(b.hasLvgl) - Number(a.hasLvgl)) || a.path.localeCompare(b.path));
  sendJson(res, 200, { dir: ESPHOME_DIR, files });
}

function handleReadFile(res, relPath) {
  const full = safeResolve(relPath);
  if (!full || !/\.ya?ml$/i.test(full)) return sendJson(res, 400, { error: 'Invalid path' });
  fs.readFile(full, 'utf8', (err, content) => {
    if (err) return sendJson(res, 404, { error: 'File not found: ' + relPath });
    sendJson(res, 200, { path: relPath, content });
  });
}

function handleWriteFile(req, res, relPath) {
  const full = safeResolve(relPath);
  if (!full || !/\.ya?ml$/i.test(full)) return sendJson(res, 400, { error: 'Invalid path' });
  if (!fs.existsSync(full)) return sendJson(res, 404, { error: 'File not found: ' + relPath });

  let body = '';
  let tooLarge = false;
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_UPLOAD_BYTES) {
      tooLarge = true;
      req.destroy();
    }
  });
  req.on('end', () => {
    if (tooLarge) return;
    fs.writeFile(full, body, 'utf8', (err) => {
      if (err) return sendJson(res, 500, { error: 'Write failed: ' + err.message });
      sendJson(res, 200, { ok: true });
    });
  });
}

function serveStatic(res, pathname) {
  const filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback for client-side routes / cache-busted paths
      fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const FILE_PREFIX = '/api/esphome/file/';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/esphome/files' && req.method === 'GET') {
    return handleListFiles(res);
  }

  if (pathname.startsWith(FILE_PREFIX) && req.method === 'GET') {
    return handleReadFile(res, pathname.slice(FILE_PREFIX.length));
  }

  if (pathname.startsWith(FILE_PREFIX) && req.method === 'PUT') {
    return handleWriteFile(req, res, pathname.slice(FILE_PREFIX.length));
  }

  serveStatic(res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`esphome-lvgl-editor listening on :${PORT}, ESPHOME_DIR=${ESPHOME_DIR}`);
});
