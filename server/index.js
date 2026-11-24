// Production server: serves the built app from dist/, the JSON API (/api/*),
// uploaded images (/images/<id>), and falls back to index.html for tree links like /chris.
//
//   npm run build && npm start
//
// Config (env or .env file in the project root):
//   PORT=8080  DATABASE_URL=mysql://user:pass@localhost:3306/db  DATA_DIR=./data

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  // .env is optional; real environment variables also work
}

const { handleApi, IMAGES_DIR, IMAGE_ID_RE } = await import("./api.js");
const { ensureSchema } = await import("./db.js");

const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
};

async function sendFile(res, filePath, cacheControl, method) {
  const data = await fs.readFile(filePath);
  res.statusCode = 200;
  res.setHeader(
    "Content-Type",
    TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
  );
  res.setHeader("Cache-Control", cacheControl);
  res.end(method === "HEAD" ? undefined : data);
}

function notFound(res) {
  res.statusCode = 404;
  res.end("Not found");
}

async function serveImage(req, res, urlPath) {
  const id = urlPath.slice("/images/".length);
  if (!IMAGE_ID_RE.test(id)) return notFound(res);
  try {
    // Content-addressed (sha256), so the file at this URL never changes
    await sendFile(
      res,
      path.join(IMAGES_DIR, id),
      "public, max-age=31536000, immutable",
      req.method,
    );
  } catch {
    notFound(res);
  }
}

async function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch {
    urlPath = "/";
  }

  if (urlPath.startsWith("/images/")) return serveImage(req, res, urlPath);

  const filePath = path.join(DIST, urlPath);
  if (filePath.startsWith(DIST + path.sep) && path.extname(filePath)) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const immutable =
          urlPath.startsWith("/assets/") &&
          !urlPath.startsWith("/assets/music/");
        await sendFile(
          res,
          filePath,
          immutable
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
          req.method,
        );
        return;
      }
    } catch {
      // fall through
    }
    // A missing file with an extension is a real 404, not an app route.
    return notFound(res);
  }

  // App routes (/, /chris, ...) -> index.html
  await sendFile(res, path.join(DIST, "index.html"), "no-cache", req.method);
}

await fs.mkdir(IMAGES_DIR, { recursive: true });
await ensureSchema();

const server = http.createServer(async (req, res) => {
  try {
    if (await handleApi(req, res)) return;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.end();
      return;
    }
    await serveStatic(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Christmas tree running on http://${HOST}:${PORT}`);
  console.log(`Images directory: ${IMAGES_DIR}`);
});
