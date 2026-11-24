// Production server (no dependencies): serves the built app from dist/,
// album photos from ALBUMS_DIR, and falls back to index.html for routes like /khulan.
//
//   npm run build && npm start
//   PORT=8080 ALBUMS_DIR=/srv/xmas/albums node server/index.js

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { albumsMiddleware, ALBUMS_DIR } from './albums.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

const albums = albumsMiddleware();

async function sendFile(res, filePath, cacheControl) {
  const data = await fs.readFile(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', cacheControl);
  res.end(data);
}

async function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    urlPath = '/';
  }

  const filePath = path.join(DIST, urlPath);
  if (filePath.startsWith(DIST + path.sep) && path.extname(filePath)) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const immutable = urlPath.startsWith('/assets/') && !urlPath.startsWith('/assets/music/');
        await sendFile(res, filePath, immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
        return;
      }
    } catch {
      // fall through
    }
    // A missing file with an extension is a real 404, not an app route.
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  // App routes (/, /khulan, ...) -> index.html
  await sendFile(res, path.join(DIST, 'index.html'), 'no-cache');
}

const server = http.createServer((req, res) => {
  albums(req, res, () => {
    serveStatic(req, res).catch((err) => {
      console.error(err);
      res.statusCode = 500;
      res.end('Server error');
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Christmas tree running on http://${HOST}:${PORT}`);
  console.log(`Albums directory: ${ALBUMS_DIR}`);
});
