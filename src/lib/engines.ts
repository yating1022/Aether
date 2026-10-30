import type { EngineId } from '../types/nav';

export interface EngineDefinition {
  label: string;
  buildUrl: (query: string) => string;
}

export const ENGINES: Record<EngineId, EngineDefinition> = {
  google: {
    label: 'Google',
    buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  bing: {
    label: 'Bing',
    buildUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  },
  baidu: {
    label: 'Baidu',
    buildUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
  },
  github: {
    label: 'GitHub',
    buildUrl: (query) => `https://github.com/search?q=${encodeURIComponent(query)}`,
  },
};

export const ENGINE_ORDER: EngineId[] = ['google', 'bing', 'baidu', 'github'];
