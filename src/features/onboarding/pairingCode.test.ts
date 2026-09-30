import { describe, expect, it } from "vitest";
import { advertisedName, formatPasskey, parsePairingCode } from "./pairingCode";

describe("parsePairingCode", () => {
  it("reads serial and passkey from a label", () => {
    expect(parsePairingCode("jome://pair?s=JM-2024-0001&k=483920")).toEqual({
      serial: "JM-2024-0001",
      passkey: "483920",
    });
  });

  it("tolerates whitespace, case and a path-style target", () => {
    expect(parsePairingCode("  JOME://pair?s=jm-2024-0001&k=483920\n")).toEqual(
      {
        serial: "JM-2024-0001",
        passkey: "483920",
      },
    );
    expect(parsePairingCode("jome:pair?s=JM-2024-0001&k=483920")?.serial).toBe(
      "JM-2024-0001",
    );
  });

  it.each([
    ["not a url", "hello"],
    ["web link", "https://jome-farmer.ir/pair?s=JM-2024-0001&k=483920"],
    ["other action", "jome://reset?s=JM-2024-0001&k=483920"],
    ["no passkey", "jome://pair?s=JM-2024-0001"],
    ["short passkey", "jome://pair?s=JM-2024-0001&k=4839"],
    ["letters in passkey", "jome://pair?s=JM-2024-0001&k=48392a"],
    ["bad serial", "jome://pair?s=JM 2024&k=483920"],
  ])("rejects %s", (_, text) => {
    expect(parsePairingCode(text)).toBeNull();
  });
});

describe("advertisedName", () => {
  it("uses the last 4 characters of the serial", () => {
    expect(advertisedName("JM-2024-0001")).toBe("JoME-0001");
    expect(advertisedName("JM-DEMO-0417")).toBe("JoME-0417");
  });
});

it("formatPasskey groups digits in threes", () => {
  expect(formatPasskey("483920")).toBe("483 920");
});
