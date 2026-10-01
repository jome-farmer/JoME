import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { displayPhone } from "../lib/format";
import { clearSession, loadSession, saveSession } from "../lib/session";
import {
  getMe,
  type Identity,
  type Session,
  type User,
} from "../services/auth";
import { getToken, onUnauthorized, setToken } from "../services/client";
import type { AppThunk, RootState } from ".";

export type AuthState = "loading" | "signedOut" | "signedIn";

type State = {
  /** `loading` only while the saved session is read at launch. */
  status: AuthState;
  user?: User;
};

const initialState: State = { status: "loading" };

// The token itself stays out of the store: it lives in services/client and secure storage.
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    signedIn: (_, { payload }: PayloadAction<User>): State => ({
      status: "signedIn",
      user: payload,
    }),
    signedOut: (): State => ({ status: "signedOut" }),
    userRefreshed: (state, { payload }: PayloadAction<User>) => {
      state.user = payload;
    },
  },
});

export const authReducer = authSlice.reducer;
const { signedIn, signedOut, userRefreshed } = authSlice.actions;

export const selectAuthState = (s: RootState) => s.auth.status;
export const selectUser = (s: RootState) => s.auth.user;

/** Keep the session from a sign-in call and use its token from now on. */
export const signIn =
  ({ accessToken, user }: Session): AppThunk<Promise<void>> =>
  async (dispatch) => {
    setToken(accessToken);
    dispatch(signedIn(user));
    await saveSession({ accessToken, user });
  };

/** Forget the session on this phone. */
export const signOut = (): AppThunk<Promise<void>> => async (dispatch) => {
  setToken(undefined);
  dispatch(signedOut());
  await clearSession().catch(() => undefined);
};

/** At launch: sign out on 401, and bring back the saved session. */
export const startAuth = (): AppThunk<Promise<void>> => async (dispatch) => {
  // Only the token in use: a late 401 for an older session changes nothing.
  onUnauthorized((rejected) => {
    if (rejected === getToken()) void dispatch(signOut());
  });
  const saved = await loadSession();
  // A sign-in that finished first wins over the saved session.
  if (getToken()) return;
  if (!saved) {
    dispatch(signedOut());
    return;
  }
  setToken(saved.accessToken);
  dispatch(signedIn(saved.user));
  // Refresh the account in the background. Offline is fine: the saved copy stays.
  // An expired token comes back 401, and onUnauthorized signs out.
  getMe().then(
    (fresh) => {
      // Signed out (or in again) meanwhile: this reply is for a session that's gone.
      if (getToken() !== saved.accessToken) return;
      dispatch(userRefreshed(fresh));
      void saveSession({ ...saved, user: fresh }).catch(() => undefined);
    },
    () => undefined,
  );
};

/** How to name the account to its owner: phone first, then email, then Google. */
export function accountLabel(user: User): string {
  const by = (type: Identity["type"]) =>
    user.identities.find((i) => i.type === type)?.id;
  const phone = by("phone");
  return phone
    ? displayPhone(phone)
    : (by("email") ?? user.name ?? "Google account");
}
