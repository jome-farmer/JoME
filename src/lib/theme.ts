import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export type Theme = "system" | "light" | "dark";

const KEY = "theme.v1";

export async function loadTheme(): Promise<Theme> {
  const { value } = await Preferences.get({ key: KEY });
  return value === "light" || value === "dark" ? value : "system";
}

export async function saveTheme(theme: Theme): Promise<void> {
  await Preferences.set({ key: KEY, value: theme });
}

/** Status-bar icons must contrast with the app's background, not the phone's setting. */
export const barStyle = (theme: Theme): SystemBarsStyle =>
  theme === "dark"
    ? SystemBarsStyle.Dark
    : theme === "light"
      ? SystemBarsStyle.Light
      : SystemBarsStyle.Default;

/** Tokens switch on data-theme (design/tokens.css); "system" follows prefers-color-scheme. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  if (Capacitor.isNativePlatform()) {
    void SystemBars.setStyle({ style: barStyle(theme) }).catch(() => {});
  }
}
