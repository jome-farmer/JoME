import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL, setToken } from "./client";
import {
  acceptInvite,
  declineInvite,
  inviteTo,
  listShares,
  pendingInvites,
  removeShare,
} from "./shares";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const call = (i = 0) => {
  const [url, init] = fetchMock.mock.calls[i];
  return { url: String(url).replace(API_URL, ""), init };
};

afterEach(() => {
  fetchMock.mockReset();
  setToken(undefined);
});

describe("shares", () => {
  it("invites an identity and lists members and invitations", async () => {
    setToken("t");
    fetchMock.mockResolvedValueOnce(
      json(
        { id: "i1", identity: "email:a@b.co", invitedAt: 1, expiresAt: 2 },
        201,
      ),
    );
    await inviteTo("JM-1", "email:a@b.co");
    expect(call().url).toBe("/v1/devices/JM-1/shares");
    expect(call().init?.method).toBe("POST");
    expect(call().init?.body).toBe('{"identity":"email:a@b.co"}');

    fetchMock.mockResolvedValueOnce(json({ members: [], invites: [] }));
    expect(await listShares("JM-1")).toEqual({ members: [], invites: [] });
    expect(call(1).url).toBe("/v1/devices/JM-1/shares");
  });

  it("removes a member or cancels an invitation with a DELETE on the id", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await removeShare("JM-1", "abc123");
    expect(call().url).toBe("/v1/devices/JM-1/shares/abc123");
    expect(call().init?.method).toBe("DELETE");
  });

  it("lists, accepts and declines the invitations for this account", async () => {
    fetchMock.mockResolvedValueOnce(
      json([
        {
          id: "i1",
          serial: "JM-1",
          device: "Garden",
          inviter: "email:o@b.co",
          expiresAt: 9,
        },
      ]),
    );
    expect(await pendingInvites()).toHaveLength(1);
    expect(call().url).toBe("/v1/shares/invites");

    fetchMock.mockResolvedValueOnce(json({ serial: "JM-1", role: "member" }));
    expect(await acceptInvite("i1")).toMatchObject({ serial: "JM-1" });
    expect(call(1).url).toBe("/v1/shares/invites/i1/accept");
    expect(call(1).init?.method).toBe("POST");

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await declineInvite("i1");
    expect(call(2).url).toBe("/v1/shares/invites/i1");
    expect(call(2).init?.method).toBe("DELETE");
  });
});
