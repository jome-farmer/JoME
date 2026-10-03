import { describe, expect, it } from "vitest";
import { serverRow } from "./serverRow";

const base = { offline: false, canRegister: true };

describe("serverRow", () => {
  it("has no row for the demo board", () => {
    expect(serverRow({ ...base, linkKind: "mock" })).toBeUndefined();
  });

  it("through the internet it is online, or offline with the board", () => {
    expect(serverRow({ ...base, linkKind: "cloud" })).toMatchObject({
      value: "Online",
      canConnect: false,
    });
    expect(
      serverRow({ ...base, linkKind: "cloud", offline: true }),
    ).toMatchObject({
      value: "Offline",
      canConnect: false,
    });
  });

  it("over Bluetooth, an unknown state can still be connected when signed in", () => {
    expect(serverRow({ ...base, linkKind: "ble" })).toMatchObject({
      value: "Not reported",
      canConnect: true,
    });
    expect(
      serverRow({ ...base, linkKind: "usb", canRegister: false }),
    ).toMatchObject({ canConnect: false });
  });

  it("words each reported state", () => {
    const value = (
      state: "registering" | "registered" | "connecting" | "online",
    ) => serverRow({ ...base, linkKind: "ble", server: { state } })?.value;
    expect(value("registering")).toBe("Registering…");
    expect(value("registered")).toBe("Registered");
    expect(value("connecting")).toBe("Connecting…");
    expect(value("online")).toBe("Online");
  });

  it("a failure asks for attention and says why, in words", () => {
    const row = serverRow({
      ...base,
      linkKind: "ble",
      server: { state: "failed", reason: "REVOKED" },
    });
    expect(row).toMatchObject({
      value: "Needs attention",
      attention: true,
      canConnect: true,
    });
    expect(row?.text).toContain("Connect it again");
    expect(row?.text).not.toContain("REVOKED");
  });

  it("does not offer a second registration while one is running", () => {
    expect(
      serverRow({
        ...base,
        linkKind: "ble",
        server: { state: "registering" },
      })?.canConnect,
    ).toBe(false);
  });
});
