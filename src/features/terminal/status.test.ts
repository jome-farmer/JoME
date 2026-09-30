import { describe, expect, it } from "vitest";
import { formatWifiState } from "./status";

describe("formatWifiState", () => {
  it("shows the connected network and IP address", () => {
    expect(
      formatWifiState({
        state: "connected",
        ssid: "Garden Wi-Fi",
        ip: "192.168.1.42",
      }),
    ).toBe("Wi-Fi: connected to Garden Wi-Fi · 192.168.1.42");
  });

  it("does not render missing Wi-Fi fields", () => {
    expect(formatWifiState({ state: "connecting" })).toBe("Wi-Fi: connecting");
    expect(formatWifiState({ state: "failed" })).toBe("Wi-Fi: failed");
    expect(formatWifiState({ state: "disconnected" })).toBe(
      "Wi-Fi: disconnected",
    );
  });
});
