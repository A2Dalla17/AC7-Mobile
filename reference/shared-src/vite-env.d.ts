/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_BASE_URL?: string;
  readonly VITE_GOOGLE_MAPS_BROWSER_KEY?: string;
  readonly VITE_DEFAULT_MAP_LAT?: string;
  readonly VITE_DEFAULT_MAP_LNG?: string;
  readonly VITE_DEFAULT_CURRENCY?: string;
  readonly VITE_DRIVER_PING_MS?: string;
  readonly VITE_FEATURE_WAZE?: string;
  readonly VITE_FEATURE_NEGOTIATION?: string;
  readonly VITE_FEATURE_POOLING?: string;
  readonly VITE_FEATURE_CORPORATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
