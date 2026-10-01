import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ir.jomefarmer.jome", // docs/adr/0003-app-id.md, never change after release
  appName: "JoME",
  webDir: "dist",
  // The webview's origin is https://localhost, so the http dev server on the LAN is mixed content.
  // Allowed for now, while the app talks to that server (#103); turn off once the server is https.
  android: { allowMixedContent: true },
  plugins: {
    // The in-app splash (src/app/Splash.tsx) hides this once it's on screen, so there's no flash between them.
    SplashScreen: {
      launchAutoHide: false,
      showSpinner: false,
    },
    // Built into Capacitor 8: edge-to-edge webview, bar icons follow the system theme.
    // The UI pads itself with env(safe-area-inset-*) (index.html has viewport-fit=cover).
    SystemBars: {
      insetsHandling: "native",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
