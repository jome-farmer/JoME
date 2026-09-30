import { describe, expect, it } from "vitest";
import { appendCapped, clock, toPlainText, type TermLine } from "./lines";

describe("appendCapped", () => {
  it("keeps the newest lines when over the cap", () => {
    expect(appendCapped([1, 2, 3], [4, 5], 4)).toEqual([2, 3, 4, 5]);
    expect(appendCapped([1], [2], 4)).toEqual([1, 2]);
  });
});

describe("toPlainText", () => {
  const at = new Date(2026, 0, 1, 18, 5, 44).getTime();
  const lines: TermLine[] = [
    { id: 1, at, dir: "rx", kind: "log", text: "I (1) boot" },
    { id: 2, at, dir: "tx", kind: "msg", text: '{"id":7}' },
    { id: 3, at, dir: "rx", kind: "msg", text: '{"id":7,"ok":true}' },
  ];

  it("marks sent and received protocol lines, logs stay plain", () => {
    expect(toPlainText(lines, false)).toBe(
      'I (1) boot\n→ {"id":7}\n← {"id":7,"ok":true}',
    );
  });

  it("prefixes local HH:MM:SS when timestamps are on", () => {
    expect(clock(at)).toBe("18:05:44");
    expect(toPlainText(lines.slice(0, 1), true)).toBe("18:05:44 I (1) boot");
  });
});
