import { afterEach, describe, expect, it, vi } from "vitest";
import { getMe, type User } from "../services/auth";
import { api, getToken, setToken } from "../services/client";
import { clearSession, loadSession, saveSession } from "../lib/session";
import { makeStore } from ".";
import { signIn, signOut, startAuth } from "./authSlice";

vi.mock("../lib/session", () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(() => Promise.resolve()),
  clearSession: vi.fn(() => Promise.resolve()),
}));
vi.mock("../services/auth", () => ({ getMe: vi.fn() }));

const user = (name: string): User => ({
  id: "u1",
  role: "user",
  name,
  identities: [],
});
const flush = () => new Promise((r) => setTimeout(r));

afterEach(() => {
  setToken(undefined);
  vi.clearAllMocks();
});

describe("auth", () => {
  it("starts signed out with no saved session", async () => {
    vi.mocked(loadSession).mockResolvedValue(undefined);
    const store = makeStore();
    expect(store.getState().auth.status).toBe("loading");
    await store.dispatch(startAuth());
    expect(store.getState().auth).toEqual({ status: "signedOut" });
  });

  it("restores the saved session, then refreshes the account", async () => {
    vi.mocked(loadSession).mockResolvedValue({
      accessToken: "t1",
      user: user("old"),
    });
    vi.mocked(getMe).mockResolvedValue(user("fresh"));
    const store = makeStore();
    await store.dispatch(startAuth());
    expect(getToken()).toBe("t1");
    await flush();
    expect(store.getState().auth.user?.name).toBe("fresh");
    expect(saveSession).toHaveBeenCalledWith({
      accessToken: "t1",
      user: user("fresh"),
    });
  });

  it("ignores a late account reply after sign-out", async () => {
    vi.mocked(loadSession).mockResolvedValue({
      accessToken: "t1",
      user: user("old"),
    });
    let reply!: (u: User) => void;
    vi.mocked(getMe).mockReturnValue(new Promise((r) => (reply = r)));
    const store = makeStore();
    await store.dispatch(startAuth());
    await store.dispatch(signOut());
    reply(user("fresh"));
    await flush();
    expect(store.getState().auth).toEqual({ status: "signedOut" });
    expect(clearSession).toHaveBeenCalled();
  });

  it("a sign-in that finishes first wins over the saved session", async () => {
    let load!: (v: undefined) => void;
    vi.mocked(loadSession).mockReturnValue(new Promise((r) => (load = r)));
    const store = makeStore();
    const started = store.dispatch(startAuth());
    await store.dispatch(
      signIn({ accessToken: "t2", user: user("new"), created: false }),
    );
    load(undefined);
    await started;
    expect(store.getState().auth.status).toBe("signedIn");
    expect(getToken()).toBe("t2");
  });

  it("signs out when the server rejects the token in use", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("{}", { status: 401 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(loadSession).mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(startAuth());
    await store.dispatch(
      signIn({ accessToken: "t3", user: user("a"), created: false }),
    );
    await api("/v1/me").catch(() => undefined);
    await flush();
    expect(store.getState().auth.status).toBe("signedOut");
    vi.unstubAllGlobals();
  });
});
