import { createContext, useContext } from "react";
import { displayPhone } from "../lib/format";
import type { Identity, Session, User } from "../service/auth";

export type AuthState = "loading" | "signedOut" | "signedIn";

export type AuthContextValue = {
  /** `loading` only while the saved session is read at launch. */
  state: AuthState;
  user?: User;
  /** Keep the session from a sign-in call and use its token from now on. */
  signIn(session: Session): Promise<void>;
  /** Forget the session on this phone. */
  signOut(): Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** How to name the account to its owner: phone first, then email, then Google. */
export function accountLabel(user: User): string {
  const by = (type: Identity["type"]) =>
    user.identities.find((i) => i.type === type)?.id;
  const phone = by("phone");
  return phone
    ? displayPhone(phone)
    : (by("email") ?? user.name ?? "Google account");
}
