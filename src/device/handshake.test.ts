import { describe, expect, it } from "vitest";
import { DeviceError } from "./client";
import { validateCapabilities } from "./handshake";
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
