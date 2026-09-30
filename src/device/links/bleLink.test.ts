import { describe, expect, it } from "vitest";
import { reconnectDelay } from "../backoff";
import { chunks } from "./bleLink";

describe("chunks", () => {
  it("splits a write into MTU-sized pieces without copying past the end", () => {
    const bytes = new Uint8Array(45).map((_, i) => i);
    const parts = chunks(bytes, 20);
    expect(parts.map((p) => p.length)).toEqual([20, 20, 5]);
    expect(Array.from(parts[2])).toEqual([40, 41, 42, 43, 44]);
  });

  it("returns nothing for an empty write and one piece when it fits", () => {
    expect(chunks(new Uint8Array(0), 20)).toEqual([]);
    expect(chunks(new Uint8Array(20), 20)).toHaveLength(1);
  });
});

describe("reconnectDelay", () => {
  it("backs off 1 s, 2 s, 5 s, then every 10 s", () => {
    expect([0, 1, 2, 3, 50].map(reconnectDelay)).toEqual([
      1_000, 2_000, 5_000, 10_000, 10_000,
    ]);
  });
});
