import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL, setToken } from "./client";
import {
  acceptTransfer,
  cancelOffer,
  declineTransfer,
  detachBoard,
  offerBoard,
  pendingOffer,
  pendingTransfers,
} from "./transfers";

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

describe("transfers", () => {
  it("offers a board with the keep-access choice", async () => {
    setToken("t");
    fetchMock.mockResolvedValueOnce(
      json(
        {
          id: "t1",
          identity: "email:a@b.co",
          keepAccess: false,
          createdAt: 1,
          expiresAt: 2,
        },
        201,
      ),
    );
    await offerBoard("JM-1", "email:a@b.co", false);
    expect(call().url).toBe("/v1/devices/JM-1/transfer");
    expect(call().init?.method).toBe("POST");
    expect(JSON.parse(String(call().init?.body))).toEqual({
      identity: "email:a@b.co",
      keepAccess: false,
    });
  });

  it("reads no pending offer as undefined, and cancels one", async () => {
    setToken("t");
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "NOT_FOUND", message: "none" } }, 404),
    );
    expect(await pendingOffer("JM-1")).toBeUndefined();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await cancelOffer("JM-1");
    expect(call(1).init?.method).toBe("DELETE");
    expect(call(1).url).toBe("/v1/devices/JM-1/transfer");
  });

  it("lists, accepts and declines offers made to this account", async () => {
    setToken("t");
    fetchMock.mockResolvedValueOnce(json([]));
    await pendingTransfers();
    expect(call().url).toBe("/v1/transfers");
    fetchMock.mockResolvedValueOnce(json({ serial: "JM-1", role: "owner" }));
    await acceptTransfer("t 1");
    expect(call(1).url).toBe("/v1/transfers/t%201/accept");
    expect(call(1).init?.method).toBe("POST");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await declineTransfer("t1");
    expect(call(2).url).toBe("/v1/transfers/t1");
    expect(call(2).init?.method).toBe("DELETE");
  });

  it("detaches with the serial repeated as confirmation", async () => {
    setToken("t");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await detachBoard("JM-1");
    expect(call().url).toBe("/v1/devices/JM-1?confirm=JM-1");
    expect(call().init?.method).toBe("DELETE");
  });
});
