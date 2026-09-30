import { describe, expect, it } from "vitest";
import { networkList, passwordProblem, wifiFailureText } from "./wifi";

describe("networkList", () => {
  it("keeps the strongest entry per name, drops hidden networks, sorts by signal", () => {
    expect(
      networkList([
        { ssid: "Home", rssi: -70, secure: true },
        { ssid: "Guest", rssi: -50, secure: false },
        { ssid: "Home", rssi: -45, secure: true },
        { ssid: "", rssi: -30, secure: true },
      ]),
    ).toEqual([
      { ssid: "Home", rssi: -45, secure: true },
      { ssid: "Guest", rssi: -50, secure: false },
    ]);
  });
});

describe("passwordProblem", () => {
  const secure = { ssid: "Home", rssi: -50, secure: true };
  it("accepts 8–63 characters on secured networks, anything on open ones", () => {
    expect(passwordProblem(secure, "12345678")).toBeUndefined();
    expect(passwordProblem(secure, "1234567")).toMatch(/at least 8/);
    expect(passwordProblem(secure, "x".repeat(64))).toMatch(/at most 63/);
    expect(passwordProblem({ ...secure, secure: false }, "")).toBeUndefined();
  });
});

describe("wifiFailureText", () => {
  it("turns ESP-IDF reasons into plain words", () => {
    expect(wifiFailureText("AUTH_FAIL")).toMatch(/wrong password/);
    expect(wifiFailureText("4WAY_HANDSHAKE_TIMEOUT")).toMatch(/wrong password/);
    expect(wifiFailureText("NO_AP_FOUND")).toMatch(/can't see this network/);
    expect(wifiFailureText("BEACON_TIMEOUT")).toBe(
      "Couldn't join (BEACON_TIMEOUT). Try again.",
    );
  });
});
