/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HEALTHCARE_DATA_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
