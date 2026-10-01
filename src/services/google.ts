/** The Google sign-in sheet (docs/cloud.md, Sign-in): an ID token for POST /v1/auth/google. */

import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

// OAuth client IDs from the Google Cloud project. Android and the web use the web one;
// iOS has its own (and its reversed form is a URL scheme in Info.plist).
const WEB = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
const IOS = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID;

const configured = !!WEB && (Capacitor.getPlatform() !== "ios" || !!IOS);

/** Whether to offer Continue with Google: only with client IDs (the web one is in the committed .env). */
export const googleAvailable = configured;

let ready: Promise<void> | undefined;

/** Load Google's sign-in early: on the web its script must be in place before the tap. */
export function prepareGoogle(): Promise<void> {
  if (!configured) return Promise.resolve();
  return (ready ??= SocialLogin.initialize({
    google: {
      webClientId: WEB,
      iOSClientId: IOS,
      // So the ID token's audience is the web client, which the server checks.
      iOSServerClientId: WEB,
      // Web only: Google's popup returns here. One fixed path, registered as a redirect URI
      // on the web client, instead of whichever page the popup was opened from.
      redirectUrl:
        Capacitor.getPlatform() === "web"
          ? `${window.location.origin}/signin`
          : undefined,
      mode: "online",
    },
  }));
}

/** Show Google's sheet; resolves with its ID token and the nonce it carries. */
export async function googleIdToken(): Promise<{
  idToken: string;
  nonce?: string;
}> {
  if (!configured)
    throw new Error("Google sign-in isn't set up in this build.");
  await prepareGoogle();
  const nonce = crypto.randomUUID();
  const { result } = await SocialLogin.login({
    provider: "google",
    options: { scopes: ["email", "profile"], nonce },
  });
  const idToken = result.responseType === "online" ? result.idToken : null;
  if (!idToken) throw new Error("Google didn't sign you in. Try again.");
  return { idToken, nonce };
}
