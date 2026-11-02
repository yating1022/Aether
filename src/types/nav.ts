export interface Category {
  /** PocketBase record id (15-char string, NOT numeric). */
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface LinkItem {
  /** PocketBase record id (15-char string, NOT numeric). */
  id: string;
  /** PocketBase `links.category` relation id. */
  category_id: string;
  title: string;
  url: string;
  description: string;
  /** Fully-resolved, directly usable `<img src>` URL. Empty when the record has no icon file. */
  icon: string;
  sort_order: number;
  created_at: string;
}

export interface CategoryWithLinks extends Category {
  links: LinkItem[];
}

export interface LinkDraft {
  /** Target PocketBase category record id. */
  category_id: string;
  title: string;
  url: string;
  description: string;
}

export type Theme = 'light' | 'dark';
export type EngineId = 'google' | 'bing' | 'baidu' | 'github';

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Site branding stored in the single-record `settings` collection.
 */
export interface BrandSettings {
  /** Empty string means "not customised" — callers fall back to DEFAULT_BRAND.title. */
  title: string;
  /** Fully-resolved `<img src>`; empty string means use the built-in default mark. */
  logo: string;
}

/** Payload persisted to localStorage so the first paint needs no network. */
export interface NavSnapshot {
  brand: BrandSettings;
  categories: CategoryWithLinks[];
  /** Epoch ms of the last successful remote sync. Informational only — never used to expire. */
  savedAt: number;
}

/** One link's new position after a drag. */
export interface LinkMove {
  id: string;
  /** Target category record id (may differ from the current one — cross-tray drag). */
  category: string;
  /** 1-based position inside that category. */
  sort_order: number;
}
