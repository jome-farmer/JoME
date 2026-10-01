/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DouSHamBE base URL (docs/cloud.md). Defaults to http://localhost:8000. */
  readonly VITE_API_URL?: string;
  /** Google OAuth web client ID (Android and web sign-in; docs/cloud.md). */
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string;
  /** Google OAuth iOS client ID. */
  readonly VITE_GOOGLE_IOS_CLIENT_ID?: string;
}
