import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { getMe, type Session, type User } from "../service/auth";
import { onUnauthorized, setToken } from "../service/client";
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from "./AuthContext";

// Keychain on iOS, Keystore on Android, localStorage on the web (docs/architecture.md, Session).
const KEY = "session.v1";

type Saved = { accessToken: string; user: User };

async function load(): Promise<Saved | undefined> {
  try {
    const saved = JSON.parse(
      (await SecureStorage.getItem(KEY)) ?? "null",
    ) as Saved | null;
    return saved?.accessToken && saved.user ? saved : undefined;
  } catch {
    // Unreadable (corrupt, or the keystore was reset): signed out rather than stuck.
    return undefined;
  }
}

/** Owns the session: signed in or out, the token on every API call, and sign-out on 401. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("loading");
  const [user, setUser] = useState<User>();
  // The token in use now, so a late /v1/me reply can't bring back a session that was signed out.
  const current = useRef<string | undefined>(undefined);

  const signOut = useCallback(async () => {
    current.current = undefined;
    setToken(undefined);
    setUser(undefined);
    setState("signedOut");
    await SecureStorage.removeItem(KEY).catch(() => undefined);
  }, []);

  const signIn = useCallback(async ({ accessToken, user }: Session) => {
    current.current = accessToken;
    setToken(accessToken);
    setUser(user);
    setState("signedIn");
    await SecureStorage.setItem(KEY, JSON.stringify({ accessToken, user }));
  }, []);

  useEffect(() => {
    onUnauthorized((rejected) => {
      if (rejected === current.current) void signOut();
    });
    let live = true;
    void load().then((saved) => {
      // A sign-in that finished first wins over the saved session.
      if (!live || current.current) return;
      if (!saved) {
        setState("signedOut");
        return;
      }
      current.current = saved.accessToken;
      setToken(saved.accessToken);
      setUser(saved.user);
      setState("signedIn");
      // Refresh the account in the background. Offline is fine: the saved copy stays.
      // An expired token comes back 401, and onUnauthorized signs out.
      getMe().then(
        (fresh) => {
          if (!live || current.current !== saved.accessToken) return;
          setUser(fresh);
          void SecureStorage.setItem(
            KEY,
            JSON.stringify({ accessToken: saved.accessToken, user: fresh }),
          ).catch(() => undefined);
        },
        () => undefined,
      );
    });
    return () => {
      live = false;
      onUnauthorized(undefined);
    };
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, user, signIn, signOut }),
    [state, user, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
