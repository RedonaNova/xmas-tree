// Mongolian Cyrillic -> Latin, the common everyday romanization (Хулан -> khulan, Өлзий -> ulzii).
const MN_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'ye', ё: 'yo', ж: 'j', з: 'z', и: 'i',
  й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', ө: 'u', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ү: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: 'i',
  ы: 'y', ь: 'i', э: 'e', ю: 'yu', я: 'ya',
};

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Turns a display name into a URL-safe slug, e.g. "Хулан Бат" -> "khulan-bat". */
export const slugify = (name: string): string => {
  const latin = Array.from(name.toLowerCase())
    .map(ch => MN_TO_LATIN[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

  return latin
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
};

/** Cleans up a slug the user is typing (keeps a trailing dash while typing). */
export const sanitizeSlugInput = (value: string): string =>
  slugify(value.replace(/-$/, ' ')) + (value.endsWith('-') || value.endsWith(' ') ? '-' : '');
