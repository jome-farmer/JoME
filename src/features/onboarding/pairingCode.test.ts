import { describe, expect, it } from "vitest";
import {
  advertisedName,
  formatPasskey,
  LINK_HOST,
  parsePairingCode,
} from "./pairingCode";

describe("parsePairingCode", () => {
  const HOST = "link.jome-farmer.ir";

  it("reads serial and PIN from the label link", () => {
    expect(
      parsePairingCode(`https://${HOST}/p?s=JM-2024-0001#pin=483920`, HOST),
    ).toEqual({ serial: "JM-2024-0001", passkey: "483920" });
  });

  it("reads the app form the link page falls back to", () => {
    expect(
      parsePairingCode("jome://pair?s=JM-2024-0001&pin=483920", HOST),
    ).toEqual({ serial: "JM-2024-0001", passkey: "483920" });
  });

  it("tolerates whitespace, case, a trailing slash and a path-style target", () => {
    expect(
      parsePairingCode(
        `  HTTPS://${HOST.toUpperCase()}/p/?s=jm-2024-0001#pin=483920\n`,
        HOST,
      ),
    ).toEqual({ serial: "JM-2024-0001", passkey: "483920" });
    expect(
      parsePairingCode("jome:pair?s=JM-2024-0001&pin=483920", HOST)?.serial,
    ).toBe("JM-2024-0001");
  });

  it("uses the configured link host by default", () => {
    expect(
      parsePairingCode(`https://${LINK_HOST}/p?s=JM-2024-0001#pin=483920`)
        ?.serial,
    ).toBe("JM-2024-0001");
  });

  it.each([
    ["not a url", "hello"],
    ["another host", "https://evil.example/p?s=JM-2024-0001#pin=483920"],
    [
      "a look-alike host",
      `https://${HOST}.evil.example/p?s=JM-2024-0001#pin=483920`,
    ],
    ["http", `http://${HOST}/p?s=JM-2024-0001#pin=483920`],
    ["another path", `https://${HOST}/x?s=JM-2024-0001#pin=483920`],
    [
      "PIN in the query, not the fragment",
      `https://${HOST}/p?s=JM-2024-0001&pin=483920`,
    ],
    ["the old k form", "jome://pair?s=JM-2024-0001&k=483920"],
    ["the old k form in a link", `https://${HOST}/p?s=JM-2024-0001#k=483920`],
    ["other action", "jome://reset?s=JM-2024-0001&pin=483920"],
    ["no PIN", `https://${HOST}/p?s=JM-2024-0001`],
    ["short PIN", "jome://pair?s=JM-2024-0001&pin=4839"],
    ["letters in the PIN", "jome://pair?s=JM-2024-0001&pin=48392a"],
    ["bad serial", "jome://pair?s=JM 2024&pin=483920"],
  ])("rejects %s", (_, text) => {
    expect(parsePairingCode(text, HOST)).toBeNull();
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
