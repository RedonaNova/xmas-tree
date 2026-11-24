# 🎄 Christmas Tree

Interactive 3D Christmas tree decorated with photos. UI is in Mongolian. Works on desktop and phones.

Based on [gracetyy/christmas-tree](https://github.com/gracetyy/christmas-tree) (MIT, see `LICENSE`).

## How it works

| URL | What it does |
| --- | --- |
| `/` | Empty tree. Visitors add their own photos (opens in **Засах** / Edit mode). |
| `/<link>` e.g. `/khulan` | A saved tree, opens in **Харах** / View mode. |

- **Хуваалцах** (Share) saves the tree: photos are uploaded, a link is created from the name
  (Mongolian is transliterated: Хулан → `/khulan`, Өлзий → `/ulzii`). The link can be edited;
  if it is taken, a free one is suggested (`/khulan-3f2a`).
- The person who saved a tree can update it later from the same browser, or from anywhere with
  the private **edit link** (`/khulan#edit=...`) shown after saving. Everyone else who changes a
  saved tree can only save it as a new link.
- Touch screens: 1 finger rotates, pinch zooms, 2 fingers move, double tap resets the view.

## Storage

- **MySQL** (`DATABASE_URL`): table `trees` (slug, name, slots JSON, hashed edit token). Created automatically on start.
- **Disk** (`DATA_DIR/images`): uploaded photos, JPEG ≤ 1024 px, named by SHA-256 (identical photos are stored once).

## Development

```bash
npm install
cp .env.example .env     # set DATABASE_URL
npm run build && npm start   # http://localhost:8080
# or, for hot reload: `npm start` in one terminal and `npm run dev` (port 3000) in another
```

## Deploy (VPS)

The app runs under pm2 as `surprise` from `~/apps/xmas-tree`, behind nginx (`surprise.radnaabazar.com` → `127.0.0.1:8080`).

```bash
cd ~/apps/xmas-tree
git pull
npm ci
npm run build
pm2 restart surprise
```

`.env` on the server (not in git):

```
PORT=8080
DATABASE_URL=mysql://appuser:<password>@127.0.0.1:3306/surprise
DATA_DIR=/home/cloudmn/apps/xmas-tree-data
```

Back up both the `surprise` database and `DATA_DIR`.
