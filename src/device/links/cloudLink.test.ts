import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL, setToken } from "../../lib/api";
import { DeviceClient } from "../client";
import { createCloudLink } from "./cloudLink";

/** A fake DouSHamBE: one board, a command handler, and an event stream the test writes to. */
function fakeServer({ online = true } = {}) {
  const commands: { cmd: unknown; args: unknown }[] = [];
  let push: (text: string) => void = () => {};
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.slice(API_URL.length);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status });
    if (path === "/v1/devices/JM-1")
      return json({ serial: "JM-1", name: "Backyard", online });
    if (path === "/v1/devices/JM-1/events/stream") {
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          push = (text) => c.enqueue(new TextEncoder().encode(text));
          push(": connected\n\n");
        },
      });
      return new Response(body);
    }
    if (path === "/v1/devices/JM-1/commands") {
      const { cmd, args } = JSON.parse(String(init?.body)) as {
        cmd: string;
        args?: unknown;
      };
      commands.push({ cmd, args });
      if (cmd === "wifi.scan")
        return json(
          {
            error: {
              code: "FORBIDDEN_REMOTE",
              message: "wifi.scan can't be sent remotely",
            },
          },
          403,
        );
      if (cmd === "zone.run")
        return json(
          { error: { code: "ZONE_BUSY", message: "zone 2 is watering" } },
          409,
        );
      return json({ data: { cmd } });
    }
    return json({ error: { code: "NOT_FOUND", message: path } }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { commands, event: (text: string) => push(text) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setToken(undefined);
});

describe("cloudLink", () => {
  it("answers requests through the server with the same id", async () => {
    const server = fakeServer();
    const link = createCloudLink("JM-1");
    await link.open();
    const client = new DeviceClient(link);

    await expect(client.request("status", {})).resolves.toEqual({
      cmd: "status",
    });
    expect(server.commands).toEqual([{ cmd: "status", args: {} }]);
    await link.close();
  });

  it("turns server and board errors into protocol errors", async () => {
    fakeServer();
    const link = createCloudLink("JM-1");
    await link.open();
    const client = new DeviceClient(link);

    await expect(client.request("wifi.scan", {})).rejects.toMatchObject({
      code: "FORBIDDEN_REMOTE",
    });
    await expect(
      client.request("zone.run", { zone: 1, seconds: 60 }),
    ).rejects.toMatchObject({
      code: "ZONE_BUSY",
      message: "zone 2 is watering",
    });
    await link.close();
  });

  it("turns the event stream into events, and closes when the board goes offline", async () => {
    const server = fakeServer();
    const link = createCloudLink("JM-1");
    const closed = vi.fn();
    link.onClose(closed);
    await link.open();
    const client = new DeviceClient(link);
    const states = vi.fn();
    client.on("zone.state", states);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    server.event(
      'event: zone.state\ndata: {"data": {"zone": 1, "state": "watering", "remaining": 90, "total": 90}, "at": 1}\n\n',
    );
    await vi.waitFor(() =>
      expect(states).toHaveBeenCalledWith({
        zone: 1,
        state: "watering",
        remaining: 90,
        total: 90,
      }),
    );

    server.event('event: online\ndata: {"data": true, "at": 2}\n\n');
    server.event('event: online\ndata: {"data": false, "at": 3}\n\n');
    await vi.waitFor(() =>
      expect(closed).toHaveBeenCalledWith(
        expect.objectContaining({ code: "DEVICE_OFFLINE" }),
      ),
    );
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("won't open to a board that's offline", async () => {
    fakeServer({ online: false });
    await expect(createCloudLink("JM-1").open()).rejects.toMatchObject({
      code: "DEVICE_OFFLINE",
      message: expect.stringContaining("Backyard is offline"),
    });
  });

  it("says text commands need the phone nearby", async () => {
    const server = fakeServer();
    const link = createCloudLink("JM-1");
    await link.open();
    const client = new DeviceClient(link);
    const lines: string[] = [];
    client.onLine((l) => lines.push(`${l.dir} ${l.text}`));

    await client.writeRaw("zones");
    await vi.waitFor(() =>
      expect(lines.at(-1)).toMatch(
        /^rx E \(cloud\) Text commands need the phone nearby/,
      ),
    );
    expect(server.commands).toEqual([]);
    await link.close();
  });
});
