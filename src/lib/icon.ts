/**
 * Front-end favicon acquisition.
 *
 * A pure frontend can only read icon bytes from sources that send
 * `Access-Control-Allow-Origin`. Measured on 2026-10-30:
 *
 *   unavatar.io/{host}?fallback=false   → CORS `*`, 404 when the site has no icon
 *   icon.horse/icon/{host}              → CORS `*`, always 200 (may be a placeholder)
 *   google.com/s2/favicons              → no CORS  (display-only)
 *   icons.duckduckgo.com                → no CORS  (display-only)
 *   favicon.im                          → no CORS  (display-only)
 *
 * Two important limitations, both learned the hard way:
 *
 * 1. The third-party services are keyed by **hostname only** — the port is lost.
 *    For `http://1.2.3.4:8095` they would look up `http://1.2.3.4/` (port 80),
 *    which is a different service. IP-literal hosts are not resolvable by them
 *    at all, and `icon.horse` answers with a meaningless placeholder that still
 *    passes a magic-byte check.
 * 2. Most self-hosted sites send **no CORS headers**, so their own
 *    `/favicon.png` cannot be read by the browser either.
 *
 * Strategy:
 *   - normal domain      → unavatar, then icon.horse
 *   - IP literal / :port → probe the origin's own icon paths first (works only if
 *                          that server allows CORS), never fall back to a
 *                          third-party placeholder for IPs
 *   - everything else    → give up with a reason the UI can explain, so the user
 *                          can upload an icon file manually
 */

/** Blobs smaller than this are error bodies or blank placeholders. */
const MIN_BYTES = 200;

const CACHE = new Map<string, Blob>();

type ImageKind = 'png' | 'jpeg' | 'webp' | 'ico' | 'gif';

const MIME_BY_KIND: Record<ImageKind, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
  gif: 'image/gif',
};

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export interface IconTarget {
  /** Full normalised URL of the bookmark. */
  origin: string;
  host: string;
  /** True for `1.2.3.4` style hosts — third-party icon services cannot help. */
  isIpLiteral: boolean;
  /** True when the URL carries an explicit port (e.g. `:8095`). */
  hasPort: boolean;
}

export function analyzeTarget(rawUrl: string): IconTarget | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./, '');
    return {
      origin: url.origin,
      host,
      isIpLiteral: IPV4.test(host) || host.startsWith('['),
      hasPort: url.port !== '',
    };
  } catch {
    return null;
  }
}

export function hostnameOf(rawUrl: string): string {
  return analyzeTarget(rawUrl)?.host ?? '';
}

export type IconFetchFailure =
  | 'invalid-url'
  | 'ip-or-port-unreachable'
  | 'no-icon-found';

export interface IconFetchResult {
  blob: Blob | null;
  failure: IconFetchFailure | null;
}

function detectImageKind(bytes: Uint8Array): ImageKind | null {
  const at = (i: number) => bytes[i] ?? 0;

  // PNG: 89 50 4E 47
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'png';

  // JPEG: FF D8 FF
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpeg';

  // WEBP: "RIFF" .... "WEBP"
  if (
    at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50
  ) {
    return 'webp';
  }

  // ICO: 00 00 01 00
  if (at(0) === 0x00 && at(1) === 0x00 && at(2) === 0x01 && at(3) === 0x00) return 'ico';

  // GIF: "GIF8"
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return 'gif';

  return null;
}

async function trySource(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength <= MIN_BYTES) return null;

    const kind = detectImageKind(new Uint8Array(buffer, 0, 12));
    if (!kind) return null;

    // Rebuild with a trusted MIME so PocketBase's mimeTypes allowlist accepts it
    // regardless of what the source claimed.
    return new Blob([buffer], { type: MIME_BY_KIND[kind] });
  } catch {
    return null;
  }
}

/**
 * Icon paths a self-hosted site most commonly serves. Probed directly against
 * the bookmark origin so the port is preserved. These only succeed when that
 * server also sends CORS headers.
 */
const ORIGIN_PATHS = ['/favicon.ico', '/favicon.png', '/apple-touch-icon.png', '/favicon.svg'];

function originCandidates(origin: string): string[] {
  return ORIGIN_PATHS.map((path) => `${origin}${path}`);
}

function thirdPartyCandidates(host: string): string[] {
  return [
    `https://unavatar.io/${host}?fallback=false`,
    `https://icon.horse/icon/${host}`,
  ];
}

/**
 * Fetch an icon for the given bookmark URL, trying the sources that can work for
 * this specific target. Results are memoised for the lifetime of the page.
 */
export async function fetchIcon(url: string): Promise<IconFetchResult> {
  const target = analyzeTarget(url);
  if (!target) return { blob: null, failure: 'invalid-url' };

  const cacheKey = `${target.origin}|${target.host}`;
  const cached = CACHE.get(cacheKey);
  if (cached) return { blob: cached, failure: null };

  // IP literals and explicit ports cannot be resolved by hostname-based icon
  // services; only the site itself can answer, and only if it allows CORS.
  const selfHosted = target.isIpLiteral || target.hasPort;

  const candidates = selfHosted
    ? originCandidates(target.origin)
    : [...originCandidates(target.origin), ...thirdPartyCandidates(target.host)];

  for (const candidate of candidates) {
    const blob = await trySource(candidate);
    if (blob) {
      CACHE.set(cacheKey, blob);
      return { blob, failure: null };
    }
  }

  return {
    blob: null,
    failure: selfHosted ? 'ip-or-port-unreachable' : 'no-icon-found',
  };
}

/** Drop a cached icon so the next request re-fetches from the network. */
export function clearIconCache(url?: string): void {
  if (!url) {
    CACHE.clear();
    return;
  }
  const target = analyzeTarget(url);
  if (target) CACHE.delete(`${target.origin}|${target.host}`);
}
