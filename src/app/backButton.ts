/** What the Android back button does here, most local first (issue #112). */
export type BackAction = "cancel" | "close" | "back" | "home" | "leave";

const TABS = ["/zones", "/assistant", "/schedule", "/device"];

export function backAction({
  cancelShown,
  sheetOpen,
  historyIndex,
  pathname,
}: {
  /** An inline confirm (role="alertdialog") with a [data-cancel] button is showing. */
  cancelShown: boolean;
  sheetOpen: boolean;
  /** React Router's index in this tab's history; 0 when nothing is behind. */
  historyIndex: number;
  pathname: string;
}): BackAction {
  if (cancelShown) return "cancel";
  if (sheetOpen) return "close";
  // Tabs don't walk back through each other: another tab goes Home, Home leaves (Android's norm).
  if (TABS.includes(pathname)) return "home";
  if (pathname === "/") return "leave";
  // Below the tabs (editor, terminal, setup steps): same as the in-app back buttons (navigate(-1)).
  if (historyIndex > 0) return "back";
  return "leave";
}
