// Dev/QA only: serve the exported web build (dist/) on :8081 with SPA fallback
// to index.html, so the static export can be click-tested in a browser.
// Run: node scripts/serve-dist.mjs
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath decodes %20 etc. and yields a native path (handles spaces).
const ROOT = fileURLToPath(new URL('../dist', import.meta.url));
const PORT = 8081;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  let p = normalize(join(ROOT, clean));
  if (!p.startsWith(ROOT)) return null; // path traversal guard
  if (existsSync(p) && statSync(p).isFile()) return p;
  if (existsSync(p + '.html')) return p + '.html';
  const indexed = join(p, 'index.html');
  if (existsSync(indexed)) return indexed;
  return join(ROOT, 'index.html'); // SPA fallback
}

createServer((req, res) => {
  const file = resolveFile(req.url ?? '/');
  if (!file || !existsSync(file)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`READY static export on http://localhost:${PORT}`);
});
