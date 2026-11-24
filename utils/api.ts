import { MAX_PHOTO_SIZE } from '../constants';

export interface TreeSlot {
  i: number;
  img: string | null;
}

export interface SavedTree {
  slug: string;
  name: string;
  slots: TreeSlot[];
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, public data: any = {}) {
    super(code);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON error page (e.g. proxy error)
  }
  if (!res.ok) throw new ApiError(res.status, data.error || `http_${res.status}`, data);
  return data as T;
}

export const imageUrl = (id: string) => `/images/${id}`;

/** If the URL already points to a stored image, returns its id. */
export const storedImageId = (url: string): string | null => {
  const m = /^\/images\/([a-f0-9]{64}\.(?:jpg|png|webp))$/.exec(url);
  return m ? m[1] : null;
};

/** Re-encodes any image URL (data:, blob:, same-origin) as a JPEG of at most MAX_PHOTO_SIZE px. */
const toJpegBlob = (url: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, MAX_PHOTO_SIZE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no_canvas'));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode_failed'))), 'image/jpeg', 0.88);
    };
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = url;
  });

/** Uploads a photo (unless it is already stored) and returns its image id. */
export const uploadPhoto = async (url: string): Promise<string> => {
  const existing = storedImageId(url);
  if (existing) return existing;
  const blob = await toJpegBlob(url);
  const { id } = await request<{ id: string }>('/api/images', {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  return id;
};

export const fetchTree = (slug: string) =>
  request<SavedTree>(`/api/trees/${encodeURIComponent(slug)}`);

export const createTree = (body: { name: string; slug: string; slots: TreeSlot[] }) =>
  request<{ slug: string; editToken: string }>('/api/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const updateTree = (slug: string, token: string, body: { name: string; slots: TreeSlot[] }) =>
  request<{ slug: string }>(`/api/trees/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

// --- Edit tokens: kept in this browser, keyed by slug ---
const tokenKey = (slug: string) => `xmas-tree:edit:${slug}`;

export const getEditToken = (slug: string): string | null => {
  try {
    return localStorage.getItem(tokenKey(slug));
  } catch {
    return null;
  }
};

export const setEditToken = (slug: string, token: string) => {
  try {
    localStorage.setItem(tokenKey(slug), token);
  } catch {
    // private mode etc. - the edit link still works
  }
};

/** Picks up "#edit=<token>" from a private edit link, stores it, and cleans the URL. */
export const consumeEditLinkToken = (slug: string) => {
  const m = /(?:^#|&)edit=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (!m || !slug) return;
  setEditToken(slug, m[1]);
  history.replaceState(null, '', window.location.pathname + window.location.search);
};
