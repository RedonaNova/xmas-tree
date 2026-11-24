import { useEffect, useState } from 'react';

export interface Album {
  name: string;
  photos: string[];
}

export type AlbumStatus = 'none' | 'loading' | 'ready' | 'missing';

/** First path segment, e.g. "/khulan" -> "khulan". Empty string on the root page. */
export const getAlbumSlug = (): string => {
  const segment = window.location.pathname.split('/').filter(Boolean)[0] || '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
};

/** Loads a pre-made album from the server (/api/albums/<slug>) when the URL has a slug. */
export const useAlbum = (slug: string) => {
  const [status, setStatus] = useState<AlbumStatus>(slug ? 'loading' : 'none');
  const [album, setAlbum] = useState<Album | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    fetch(`/api/albums/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Album request failed: ${res.status}`);
        const data = (await res.json()) as Album;
        if (cancelled) return;
        setAlbum({ name: data.name || '', photos: Array.isArray(data.photos) ? data.photos : [] });
        setStatus('ready');
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setStatus('missing');
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { status, album };
};
