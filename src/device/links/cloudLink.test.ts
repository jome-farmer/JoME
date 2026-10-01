import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL, setToken } from "../../lib/api";
import { DeviceClient } from "../client";
import { createCloudLink } from "./cloudLink";

const COPY = {
  status: {
    data: { wifi: {}, rainDelayUntil: null, running: [], nextRun: null },
    syncedAt: 1_790_000_100,
  },
  zones: {
    data: { zones: [{ zone: 1, name: "Lawn" }] },
    syncedAt: 1_790_000_000,
  },
};

/** A fake DouSHamBE: one board with a cloud copy, a command handler, and an event stream the test writes to. */
function fakeServer({ online = true } = {}) {
  const board = { online };
  const commands: { cmd: unknown; args: unknown }[] = [];
  let push: (text: string) => void = () => {};
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.slice(API_URL.length);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status });
    if (path === "/v1/devices/JM-1")
      return json({
        serial: "JM-1",
        name: "Backyard",
        online: board.online,
        state: COPY,
      });
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
      if (!board.online)
        return json(
          {
            error: {
              code: "DEVICE_OFFLINE",
              message: "The board isn't connected",
            },
          },
          409,
        );
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
  return { board, commands, event: (text: string) => push(text) };
}

const online = (on: boolean) =>
  `event: online\ndata: {"data": ${on}, "at": 2}\n\n`;

async function opened(server = fakeServer()) {
  const link = createCloudLink("JM-1");
  const presence = vi.fn();
  link.onPresence(presence);
  await link.open();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2)); // + the stream
  return { server, link, presence, client: new DeviceClient(link) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setToken(undefined);
});

describe("cloudLink", () => {
  it("answers requests through the server with the same id", async () => {
    const { server, link, client } = await opened();
    await expect(client.request("status", {})).resolves.toEqual({
      cmd: "status",
    });
    expect(server.commands).toEqual([{ cmd: "status", args: {} }]);
    expect(link.presence()).toEqual({ online: true });
    await link.close();
  });

  it("turns server and board errors into protocol errors", async () => {
    const { link, client } = await opened();
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

  it("turns the event stream into events", async () => {
    const { server, link, client } = await opened();
    const states = vi.fn();
    client.on("zone.state", states);
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
    await link.close();
  });

  it("opens to an offline board and answers reads from the cloud copy", async () => {
    const { server, link, client } = await opened(
      fakeServer({ online: false }),
    );
    expect(link.presence()).toEqual({ online: false, syncedAt: 1_790_000_100 });

    await expect(client.request("zones.list", {})).resolves.toEqual(
      COPY.zones.data,
    );
    // Not in the copy, or a change: refused at once, never sent.
    await expect(client.request("hello", {})).rejects.toMatchObject({
      code: "DEVICE_OFFLINE",
    });
    await expect(
      client.request("zone.run", { zone: 1, seconds: 60 }),
    ).rejects.toMatchObject({
      code: "DEVICE_OFFLINE",
      message: "Backyard is offline. Changes need it online.",
    });
    expect(server.commands).toEqual([]);
    await link.close();
  });

  it("follows the board going offline and coming back", async () => {
    const { server, link, presence, client } = await opened();

    server.board.online = false;
    server.event(online(false));
    await vi.waitFor(() =>
      expect(presence).toHaveBeenLastCalledWith({
        online: false,
        syncedAt: 1_790_000_100,
      }),
    );
    await expect(client.request("status", {})).resolves.toEqual(
      COPY.status.data,
    );

    server.board.online = true;
    server.event(online(true));
    await vi.waitFor(() =>
      expect(presence).toHaveBeenLastCalledWith({ online: true }),
    );
    await expect(client.request("status", {})).resolves.toEqual({
      cmd: "status",
    });
    expect(presence).toHaveBeenCalledTimes(2);
    await link.close();
  });

  it("switches to the copy when a command finds the board offline first", async () => {
    const { server, presence, client, link } = await opened();
    server.board.online = false; // The stream hasn't said so yet.
    await expect(client.request("status", {})).resolves.toEqual(
      COPY.status.data,
    );
    expect(presence).toHaveBeenCalledWith({
      online: false,
      syncedAt: 1_790_000_100,
    });
    await link.close();
  });

  it("says text commands need the phone nearby", async () => {
    const { server, link, client } = await opened();
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
