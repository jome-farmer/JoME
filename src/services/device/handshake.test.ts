import { describe, expect, it, vi } from "vitest";
import { DeviceError, type DeviceClient } from "./client";
import { handshake, validateCapabilities } from "./handshake";
import type { Hello } from "./types";

const hello = (cmds: string[]): Hello => ({
  proto: 1,
  fw: "1.0.0",
  hw: "ESP32",
  serial: "JM-1",
  name: "Garden",
  zoneCount: 1,
  valveCount: 1,
  cmds,
});

describe("validateCapabilities", () => {
  it("accepts the app baseline", () => {
    expect(() =>
      validateCapabilities(
        hello(["hello", "time.set", "status", "zones.list", "programs.list"]),
      ),
    ).not.toThrow();
  });

  it("rejects a partial firmware before it can time out", () => {
    expect(() => validateCapabilities(hello(["hello", "time.set"]))).toThrow(
      DeviceError,
    );
  });
});

describe("handshake", () => {
  const board = () => {
    const request = vi.fn(async (cmd: string) =>
      cmd === "hello"
        ? hello(["hello", "time.set", "status", "zones.list", "programs.list"])
        : {},
    );
    return { client: { request } as unknown as DeviceClient, request };
  };

  it("sets the board's clock", async () => {
    const { client, request } = board();
    await handshake(client, { now: new Date(1_790_000_000_000) });
    expect(request).toHaveBeenCalledWith("time.set", {
      epoch: 1_790_000_000,
      tz: expect.any(String),
    });
  });

  it("leaves the clock alone through the server (the board has NTP)", async () => {
    const { client, request } = board();
    await expect(handshake(client, { setClock: false })).resolves.toMatchObject(
      {
        serial: "JM-1",
      },
    );
    expect(request.mock.calls.map(([cmd]) => cmd)).toEqual(["hello"]);
  });
});
