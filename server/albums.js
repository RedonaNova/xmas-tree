// Album storage: each album is a folder inside ALBUMS_DIR, e.g.
//   albums/khulan/01.jpg, 02.jpg, ...
//   albums/khulan/album.json   (optional) { "name": "Хулан" }
// The folder name is the URL slug: /khulan

import fs from 'node:fs/promises';
import path from 'node:path';

export const ALBUMS_DIR = path.resolve(process.env.ALBUMS_DIR || 'albums');

const SLUG_RE = /^[a-z0-9_-]+$/i;

export const IMAGE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

/** Returns { name, photos: string[] } or null if the album does not exist. */
export async function readAlbum(slug) {
  if (!SLUG_RE.test(slug)) return null;
  const dir = path.join(ALBUMS_DIR, slug);

  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }

  const photos = entries
    .filter((f) => IMAGE_TYPES[path.extname(f).toLowerCase()])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => `/albums/${slug}/${encodeURIComponent(f)}`);

  let name = '';
  try {
    const meta = JSON.parse(await fs.readFile(path.join(dir, 'album.json'), 'utf8'));
    if (typeof meta.name === 'string') name = meta.name;
  } catch {
    // album.json is optional
  }

  return { name, photos };
}

/** Resolves /albums/<slug>/<file> to an absolute path inside ALBUMS_DIR, or null. */
export function resolveAlbumFile(urlPath) {
  const match = /^\/albums\/([^/]+)\/([^/]+)$/.exec(urlPath);
  if (!match) return null;
  const slug = match[1];
  let file;
  try {
    file = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  if (!SLUG_RE.test(slug) || file.includes('/') || file.includes('\\') || file.startsWith('.')) return null;
  const type = IMAGE_TYPES[path.extname(file).toLowerCase()];
  if (!type) return null;
  return { filePath: path.join(ALBUMS_DIR, slug, file), type };
}

/**
 * Connect-style middleware handling:
 *   GET /api/albums/<slug>      -> JSON { name, photos }
 *   GET /albums/<slug>/<file>   -> image file
 * Calls next() for anything else.
 */
export function albumsMiddleware() {
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const urlPath = (req.url || '').split('?')[0];

    const api = /^\/api\/albums\/([^/]+)\/?$/.exec(urlPath);
    if (api) {
      const album = await readAlbum(api[1]);
      res.statusCode = album ? 200 : 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(JSON.stringify(album || { error: 'not_found' }));
      return;
    }

    if (urlPath.startsWith('/albums/')) {
      const resolved = resolveAlbumFile(urlPath);
      if (!resolved) {
        res.statusCode = 404;
        res.end();
        return;
      }
      try {
        const data = await fs.readFile(resolved.filePath);
        res.statusCode = 200;
        res.setHeader('Content-Type', resolved.type);
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.end(req.method === 'HEAD' ? undefined : data);
      } catch {
        res.statusCode = 404;
        res.end();
      }
      return;
    }

    next();
  };
}
