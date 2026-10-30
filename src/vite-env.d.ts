/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the PocketBase instance, e.g. https://pb.example.com */
  readonly VITE_PB_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
