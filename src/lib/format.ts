export { hostnameOf } from './icon';

/** Stable hue (0-359) derived from a string, used for icon tints. */
export function hueOf(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
}

export function initialOf(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return '?';
  const first = Array.from(trimmed)[0] ?? '?';
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}

/**
 * Display-only fallback icon for bookmarks that have no uploaded icon file.
 * `icon.horse` sends permissive CORS and always resolves to an image, so it
 * never flashes a broken image (unlike a direct `/favicon.ico` probe).
 */
export function fallbackFaviconUrl(url: string): string {
  try {
    const hostname = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
    if (!hostname) return '';
    return `https://icon.horse/icon/${hostname}`;
  } catch {
    return '';
  }
}

export function ensureProtocol(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
