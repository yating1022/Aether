import { BaseAuthStore } from 'pocketbase';
import type { AuthRecord } from 'pocketbase';
import { readString, removeKey, writeString } from './storage';

/**
 * Storage-safe replacement for PocketBase's `LocalAuthStore`.
 *
 * The SDK's own store reads `localStorage.getItem()` *outside* any try/catch
 * (`_storageGet`), and `Client.send()` reads the token on **every** request.
 * So when storage throws — Safari private mode, a blocked origin, a denied
 * localStorage — every API call fails, not just the login screen.
 *
 * This store keeps the same persistence behaviour but routes all storage access
 * through `lib/storage.ts`, which never throws. A failed write only means the
 * session will not survive a reload.
 */
export class SafeAuthStore extends BaseAuthStore {
  private readonly storageKey: string;

  constructor(storageKey = 'pocketbase_auth') {
    super();
    this.storageKey = storageKey;
    this.restore();
  }

  private restore(): void {
    const raw = readString(this.storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { token?: string; record?: AuthRecord; model?: AuthRecord };
      if (parsed?.token) {
        // Seed the in-memory state without re-persisting what we just read.
        super.save(parsed.token, parsed.record ?? parsed.model);
      }
    } catch {
      // Corrupt payload: start logged out instead of crashing the boot path.
    }
  }

  override save(token: string, record?: AuthRecord): void {
    super.save(token, record);
    try {
      writeString(this.storageKey, JSON.stringify({ token, record: record ?? null }));
    } catch {
      // Session simply will not persist.
    }
  }

  override clear(): void {
    super.clear();
    removeKey(this.storageKey);
  }
}
