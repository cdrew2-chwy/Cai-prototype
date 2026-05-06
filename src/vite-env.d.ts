/// <reference types="vite/client" />
/// <reference types="@figma/code-connect/figma-types" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
