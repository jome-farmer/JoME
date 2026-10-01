import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { backAction } from "./backButton";

/**
 * The Android back button (and back gesture): cancel a confirm, close a sheet,
 * go back a screen, go Home, and only then leave the app. Renders nothing.
 */
export function AndroidBack() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    const listener = App.addListener("backButton", () => {
      const sheets =
        document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      const sheet = sheets[sheets.length - 1];
      // A confirm inside the top sheet goes first, then one on the screen.
      const cancel = (sheet ?? document).querySelector<HTMLElement>(
        '[role="alertdialog"] [data-cancel]',
      );
      const historyIndex =
        (window.history.state as { idx?: number } | null)?.idx ?? 0;
      switch (
        backAction({
          cancelShown: !!cancel,
          sheetOpen: !!sheet,
          historyIndex,
          pathname,
        })
      ) {
        case "cancel":
          return cancel?.click();
        case "close":
          // Same as Esc: Sheet asks its parent to close it.
          return void sheet?.dispatchEvent(
            new Event("cancel", { cancelable: true }),
          );
        case "back":
          return void navigate(-1);
        case "home":
          return void navigate("/", { replace: true });
        case "leave":
          // Android's own habit at the root: the app goes to the background, not away.
          return void App.minimizeApp();
      }
    });
    return () => void listener.then((l) => l.remove());
  }, [navigate, pathname]);

  return null;
}
