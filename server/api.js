// JSON API for saved trees + image uploads.
//
//   POST /api/images              raw image body (jpeg/png/webp, <= 4 MB) -> { id }
//   GET  /api/trees/:slug                                                 -> { slug, name, slots }
//   POST /api/trees               { name, slug, slots }                   -> { slug, editToken }
//   PUT  /api/trees/:slug         { name, slots } + Authorization: Bearer <editToken>
//
// A tree's slots are [{ i: <slot index 0..29>, img: <image id> | null }].
// Missing slot indices are photos the author deleted from the tree.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getPool } from './db.js';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const IMAGES_DIR = path.join(DATA_DIR, 'images');

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_JSON_BYTES = 64 * 1024;
const SLOT_COUNT = 30;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
export const IMAGE_ID_RE = /^[a-f0-9]{64}\.(jpg|png|webp)$/;
const RESERVED_SLUGS = new Set([
  'api', 'images', 'assets', 'albums', 'media', 'static', 'index', 'favicon',
  'new', 'edit', 'admin', 'login', 'share', 'tree', 'trees', 'robots', 'sitemap',
]);

class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// --- Small in-memory rate limiter (per IP, per bucket) ---
const hits = new Map();
function rateLimit(ip, bucket, limit, windowMs) {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  let entry = hits.get(key);
  if (!entry || entry.reset < now) {
    entry = { count: 0, reset: now + windowMs };
    hits.set(key, entry);
  }
  entry.count++;
  if (entry.count > limit) throw new HttpError(429, 'rate_limited');
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
}, 10 * 60 * 1000).unref();

function clientIp(req) {
  return String(req.headers['x-real-ip'] || req.socket.remoteAddress || '').slice(0, 45);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > maxBytes) {
      reject(new HttpError(413, 'too_large'));
      req.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new HttpError(413, 'too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req, MAX_JSON_BYTES);
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'bad_json');
  }
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

function detectImageExt(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function cleanName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60);
}

async function imageExists(id) {
  try {
    await fs.access(path.join(IMAGES_DIR, id));
    return true;
  } catch {
    return false;
  }
}

async function validateSlots(slots) {
  if (!Array.isArray(slots) || slots.length > SLOT_COUNT) throw new HttpError(400, 'bad_slots');
  const seen = new Set();
  const clean = [];
  for (const s of slots) {
    const i = s && s.i;
    const img = s && s.img;
    if (!Number.isInteger(i) || i < 0 || i >= SLOT_COUNT || seen.has(i)) throw new HttpError(400, 'bad_slots');
    if (img !== null && (typeof img !== 'string' || !IMAGE_ID_RE.test(img))) throw new HttpError(400, 'bad_slots');
    if (img && !(await imageExists(img))) throw new HttpError(400, 'missing_image', { img });
    seen.add(i);
    clean.push({ i, img: img || null });
  }
  return clean.sort((a, b) => a.i - b.i);
}

const randomSuffix = () => crypto.randomBytes(3).toString('hex').slice(0, 4);

async function slugTaken(slug) {
  const [rows] = await getPool().query('SELECT 1 FROM trees WHERE slug = ? LIMIT 1', [slug]);
  return rows.length > 0;
}

async function suggestSlug(base) {
  const root = (base || 'tree').slice(0, 34).replace(/-+$/, '') || 'tree';
  for (let n = 0; n < 10; n++) {
    const candidate = `${root}-${randomSuffix()}`;
    if (!(await slugTaken(candidate))) return candidate;
  }
  return `tree-${crypto.randomBytes(6).toString('hex')}`;
}

function parseTreeRow(row) {
  const slots = typeof row.slots === 'string' ? JSON.parse(row.slots) : row.slots;
  return { slug: row.slug, name: row.name, slots, updatedAt: row.updated_at };
}

// --- Handlers ---

async function uploadImage(req, res) {
  rateLimit(clientIp(req), 'images', 400, 60 * 60 * 1000);
  const buf = await readBody(req, MAX_IMAGE_BYTES);
  const ext = detectImageExt(buf);
  if (!ext) throw new HttpError(415, 'unsupported_image');

  const id = `${sha256(buf)}.${ext}`;
  const filePath = path.join(IMAGES_DIR, id);
  if (!(await imageExists(id))) {
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, buf);
    await fs.rename(tmp, filePath);
  }
  sendJson(res, 201, { id });
}

async function getTree(res, slug) {
  if (!SLUG_RE.test(slug)) throw new HttpError(404, 'not_found');
  const [rows] = await getPool().query('SELECT slug, name, slots, updated_at FROM trees WHERE slug = ?', [slug]);
  if (!rows.length) throw new HttpError(404, 'not_found');
  sendJson(res, 200, parseTreeRow(rows[0]));
}

async function createTree(req, res) {
  const ip = clientIp(req);
  rateLimit(ip, 'create', 30, 60 * 60 * 1000);
  const body = await readJson(req);
  const name = cleanName(body.name);
  const slots = await validateSlots(body.slots);
  if (!slots.some((s) => s.img)) throw new HttpError(400, 'no_photos');

  let slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  if (!slug) slug = await suggestSlug('tree');
  if (!SLUG_RE.test(slug)) throw new HttpError(400, 'bad_slug');
  if (RESERVED_SLUGS.has(slug)) throw new HttpError(409, 'slug_taken', { suggestion: await suggestSlug(slug) });

  const editToken = crypto.randomBytes(24).toString('base64url');
  try {
    await getPool().query(
      'INSERT INTO trees (slug, name, slots, edit_token_hash, created_ip) VALUES (?, ?, ?, ?, ?)',
      [slug, name, JSON.stringify(slots), sha256(editToken), ip]
    );
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'slug_taken', { suggestion: await suggestSlug(slug) });
    }
    throw err;
  }
  sendJson(res, 201, { slug, editToken });
}

async function updateTree(req, res, slug) {
  rateLimit(clientIp(req), 'update', 120, 60 * 60 * 1000);
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'unauthorized');

  const [rows] = await getPool().query('SELECT edit_token_hash FROM trees WHERE slug = ?', [slug]);
  if (!rows.length) throw new HttpError(404, 'not_found');
  const expected = Buffer.from(rows[0].edit_token_hash, 'hex');
  const given = Buffer.from(sha256(token), 'hex');
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    throw new HttpError(403, 'forbidden');
  }

  const body = await readJson(req);
  const name = cleanName(body.name);
  const slots = await validateSlots(body.slots);
  if (!slots.some((s) => s.img)) throw new HttpError(400, 'no_photos');

  await getPool().query('UPDATE trees SET name = ?, slots = ? WHERE slug = ?', [name, JSON.stringify(slots), slug]);
  sendJson(res, 200, { slug });
}

/** Returns true if the request was an API request (handled), false otherwise. */
export async function handleApi(req, res) {
  const urlPath = (req.url || '').split('?')[0];
  if (!urlPath.startsWith('/api/')) return false;

  try {
    if (urlPath === '/api/images' && req.method === 'POST') {
      await uploadImage(req, res);
    } else if (urlPath === '/api/trees' && req.method === 'POST') {
      await createTree(req, res);
    } else {
      const m = /^\/api\/trees\/([^/]+)$/.exec(urlPath);
      if (m && req.method === 'GET') await getTree(res, m[1]);
      else if (m && req.method === 'PUT') await updateTree(req, res, m[1]);
      else throw new HttpError(404, 'not_found');
    }
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.code, ...err.extra });
    } else {
      console.error(err);
      sendJson(res, 500, { error: 'server_error' });
    }
  }
  return true;
}
