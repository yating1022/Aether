import type { NavSnapshot } from '../types/nav';
import { readString, removeKey, writeString } from './storage';

/**
 * localStorage snapshot of the whole nav tree (brand + categories + links).
 *
 * Goals:
 *   - first paint renders real content without waiting for the network;
 *   - the site still opens when PocketBase is unreachable.
 *
 * Deliberate limits:
 *   - No TTL. Remote always wins; a successful fetch just overwrites the cache.
 *   - No image bytes. Only the resolved URLs are stored, so offline cached pages
 *     still rely on the browser HTTP cache for icons (cards degrade to monograms).
 *   - Every operation is exception-proof (see lib/storage.ts). Private mode, a
 *     denied origin or a full quota must never break the app — it simply runs
 *     online-only.
 */

const CACHE_KEY = 'aether.cache.v1';
const CACHE_VERSION = 1;

/** Guard against pathological growth (a full quota is usually only ~5MB). */
const MAX_BYTES = 1024 * 1024;

interface CacheEnvelope {
  version: number;
  snapshot: NavSnapshot;
}

function isSnapshot(value: unknown): value is NavSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NavSnapshot>;
  return (
    !!candidate.brand &&
    typeof candidate.brand === 'object' &&
    typeof candidate.brand.title === 'string' &&
    typeof candidate.brand.logo === 'string' &&
    Array.isArray(candidate.categories)
  );
}

/**
 * Read the snapshot synchronously so it can seed `useState` on the very first
 * render. Returns null when there is nothing trustworthy to show.
 */
export function readCache(): NavSnapshot | null {
  const raw = readString(CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope>;
    // A structure change bumps the version; stale caches are dropped, not migrated.
    if (parsed?.version !== CACHE_VERSION || !isSnapshot(parsed.snapshot)) return null;

    return parsed.snapshot;
  } catch {
    // Corrupt payload: treat as no cache rather than crashing the boot path.
    return null;
  }
}

/** Best-effort write. Silently gives up when storage is unavailable or oversized. */
export function writeCache(snapshot: NavSnapshot): void {
  let payload: string;
  try {
    payload = JSON.stringify({ version: CACHE_VERSION, snapshot } satisfies CacheEnvelope);
  } catch {
    return;
  }

  if (payload.length > MAX_BYTES) {
    // Something is very wrong; drop the cache rather than fill the quota.
    clearCache();
    return;
  }

  writeString(CACHE_KEY, payload);
}

export function clearCache(): void {
  removeKey(CACHE_KEY);
}
