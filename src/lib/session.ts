import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import type { Session, User } from "../services/auth";

// Keychain on iOS, Keystore on Android, localStorage on the web (docs/architecture.md, Session).
const KEY = "session.v1";

export type SavedSession = Pick<Session, "accessToken"> & { user: User };

export async function loadSession(): Promise<SavedSession | undefined> {
  try {
    const saved = JSON.parse(
      (await SecureStorage.getItem(KEY)) ?? "null",
    ) as SavedSession | null;
    return saved?.accessToken && saved.user ? saved : undefined;
  } catch {
    // Unreadable (corrupt, or the keystore was reset): signed out rather than stuck.
    return undefined;
  }
}

export function saveSession(saved: SavedSession): Promise<void> {
  return SecureStorage.setItem(KEY, JSON.stringify(saved));
}

export function clearSession(): Promise<void> {
  return SecureStorage.removeItem(KEY).then(() => undefined);
}
