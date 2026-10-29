/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORDERS_API_URL?: string;
  readonly VITE_FULFILLMENT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
