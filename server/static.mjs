import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export function createStatic(root) {
  const DIST_DIR = join(root, 'dist');

  return function serveStatic(path, res) {
    let rel = decodeURIComponent(path).replace(/^\/+/, '');
    if (rel.includes('..')) return false;
    let file = join(DIST_DIR, rel);
    try {
      if (!rel || !existsSync(file) || statSync(file).isDirectory()) {
        file = join(DIST_DIR, 'index.html');
      }
      if (!existsSync(file)) return false;
      const ext = extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(file));
      return true;
    } catch { return false; }
  };
}