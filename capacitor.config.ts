import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ir.jomefarmer.jome", // docs/adr/0003-app-id.md, never change after release
  appName: "JoME",
  webDir: "dist",
  plugins: {
    // Built into Capacitor 8: edge-to-edge webview, bar icons follow the system theme.
    // The UI pads itself with env(safe-area-inset-*) (index.html has viewport-fit=cover).
    SystemBars: {
      insetsHandling: "native",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
