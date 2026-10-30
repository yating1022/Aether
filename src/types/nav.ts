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
