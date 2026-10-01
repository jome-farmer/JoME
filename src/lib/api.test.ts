import { afterEach, describe, expect, it, vi } from "vitest";
import {
  api,
  ApiError,
  API_URL,
  followEvents,
  readEvents,
  onUnauthorized,
  setToken,
  type ServerEvent,
} from "./api";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  fetchMock.mockReset();
  setToken(undefined);
  vi.useRealTimers();
});

describe("api", () => {
  it("sends JSON with the bearer token and returns the parsed body", async () => {
    fetchMock.mockResolvedValue(json({ serial: "JM-1" }));
    setToken("t0k");
    const out = await api("/v1/devices/claim", {
      method: "POST",
      body: { serial: "JM-1", code: "123456" },
    });
    expect(out).toEqual({ serial: "JM-1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/v1/devices/claim`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"serial":"JM-1","code":"123456"}');
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer t0k",
      "Content-Type": "application/json",
    });
  });

  it("sends no auth header when signed out, and no body on GET", async () => {
    fetchMock.mockResolvedValue(json([]));
    await api("/v1/devices");
    const init = fetchMock.mock.calls[0][1];
    expect(init?.headers).not.toHaveProperty("Authorization");
    expect(init?.headers).not.toHaveProperty("Content-Type");
    expect(init?.body).toBeUndefined();
  });

  it("returns undefined for an empty body", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await api("/v1/devices/JM-1", { method: "DELETE" })).toBeUndefined();
  });

  it("turns the server's error shape into an ApiError", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: "ALREADY_CLAIMED", message: "taken" } }, 409),
    );
    await expect(api("/v1/devices/claim")).rejects.toMatchObject({
      name: "ApiError",
      code: "ALREADY_CLAIMED",
      message: "taken",
      status: 409,
    });
  });

  it("names the status when the body isn't the error shape", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 502 }));
    await expect(api("/v1/me")).rejects.toMatchObject({
      code: "HTTP_502",
      status: 502,
    });
  });

  it("reports a rejected token, and only when one was sent", async () => {
    const rejected = vi.fn();
    onUnauthorized(rejected);
    const unauthorized = () =>
      json({ error: { code: "UNAUTHORIZED", message: "" } }, 401);

    fetchMock.mockResolvedValue(unauthorized());
    await expect(api("/v1/auth/otp/verify")).rejects.toMatchObject({
      status: 401,
    });
    expect(rejected).not.toHaveBeenCalled();

    setToken("old");
    fetchMock.mockResolvedValue(unauthorized());
    await expect(api("/v1/me")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(rejected).toHaveBeenCalledWith("old");
    onUnauthorized(undefined);
  });

  it("reports an unreachable server as NETWORK", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await api("/v1/me").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "NETWORK", status: 0 });
  });

  it("rethrows an abort as is", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(api("/v1/me", { signal: ctrl.signal })).rejects.toHaveProperty(
      "name",
      "AbortError",
    );
  });
});

/** A body that delivers these chunks, then ends. */
const stream = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const s of chunks) c.enqueue(new TextEncoder().encode(s));
      c.close();
    },
  });

const collect = async (body: ReadableStream<Uint8Array>) => {
  const out: ServerEvent[] = [];
  for await (const e of readEvents(body)) out.push(e);
  return out;
};

describe("readEvents", () => {
  it("parses events split across chunks and skips keepalives", async () => {
    const events = await collect(
      stream(
        ": keepalive\n\nevent: zone.st",
        'ate\ndata: {"data": {"zone": 1}, "at": 1}\n\n',
        'event: online\r\ndata: {"data": false}\r\n\r\n',
      ),
    );
    expect(events).toEqual([
      { event: "zone.state", data: { data: { zone: 1 }, at: 1 } },
      { event: "online", data: { data: false } },
    ]);
  });

  it("joins multi-line data, defaults the name, and drops non-JSON", async () => {
    const events = await collect(
      stream('data: {"a":\ndata: 1}\n\n', "data: not json\n\n", "data: 2\n"),
    );
    // The last event never got its blank line, so it isn't complete.
    expect(events).toEqual([{ event: "message", data: { a: 1 } }]);
  });
});

describe("followEvents", () => {
  it("reconnects with backoff after the stream drops, and calls onOpen each time", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      async () =>
        new Response(stream('event: online\ndata: {"data": true}\n\n')),
    );
    const onEvent = vi.fn();
    const onOpen = vi.fn();
    const ctrl = new AbortController();
    followEvents(
      "/v1/devices/JM-1/events/stream",
      { onEvent, onOpen },
      ctrl.signal,
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      event: "online",
      data: { data: true },
    });
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Accept: "text/event-stream",
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenCalledTimes(2);

    ctrl.abort();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops and reports when signed out", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "" } }),
        {
          status: 401,
        },
      ),
    );
    const onError = vi.fn();
    followEvents(
      "/x",
      { onEvent: vi.fn(), onError },
      new AbortController().signal,
    );
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps retrying when the server is unreachable", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const onError = vi.fn();
    const ctrl = new AbortController();
    followEvents("/x", { onEvent: vi.fn(), onError }, ctrl.signal);
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 5_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(onError).not.toHaveBeenCalled();
    ctrl.abort();
  });
});
