import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useAppSelector } from "../store";
import { selectAuthState } from "../store/authSlice";
import { parsePairingCode } from "../features/onboarding/pairingCode";

/**
 * A label link the phone opens in the app (App Links on Android, Universal
 * Links on iOS, or `jome://pair`): go to Connect with that board's serial and
 * PIN, as if its QR had been scanned in the app. Other links are ignored.
 * Waits for the session to load, so the first-run redirect doesn't win. Renders nothing.
 */
export function DeepLinks() {
  const navigate = useNavigate();
  const authState = useAppSelector(selectAuthState);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || authState === "loading") return;
    const open = (url: string) => {
      const pairing = parsePairingCode(url);
      if (pairing) navigate("/connect", { state: { pairing } });
    };
    // Cold start: the link that launched the app.
    void App.getLaunchUrl().then((launch) => launch?.url && open(launch.url));
    const listener = App.addListener("appUrlOpen", ({ url }) => open(url));
    return () => void listener.then((l) => l.remove());
  }, [authState, navigate]);

  return null;
}
