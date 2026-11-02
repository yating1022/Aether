/**
 * Exception-proof localStorage access.
 *
 * `window.localStorage` is not always usable: Safari private mode, a blocked
 * third-party context, or an exhausted quota all make it throw. Because the
 * theme/engine preferences are read inside `useState` initialisers, an
 * unguarded `getItem` there crashes the entire render — the app would show a
 * blank page instead of simply forgetting the preference.
 *
 * Every read/write therefore degrades to "no value" rather than throwing.
 */

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readString(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Quota exceeded / storage disabled: preferences just stop persisting.
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // ignore
  }
}
