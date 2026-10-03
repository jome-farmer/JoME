/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DouSHamBE base URL (docs/cloud.md). Defaults to https://api.jome-farmer.ir. */
  readonly VITE_API_URL?: string;
  readonly VITE_LINK_HOST?: string;
  /** `true` turns the phone and email code sign-in on (needs SMS and SMTP on the server). Off by default. */
  readonly VITE_CODE_SIGNIN?: string;
  /** Google OAuth web client ID (Android and web sign-in; docs/cloud.md). */
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string;
  /** Google OAuth iOS client ID. */
  readonly VITE_GOOGLE_IOS_CLIENT_ID?: string;
}
