import { describe, expect, it } from "vitest";
import { NEEDS_NEW_REGISTRATION, serverStateText } from "./serverLink";
import type { ServerState } from "./types";

describe("serverStateText", () => {
  it("has words for every state", () => {
    for (const state of [
      "registering",
      "registered",
      "connecting",
      "online",
    ] as const)
      expect(serverStateText({ state }).length).toBeGreaterThan(5);
  });

  it("words every failure reason, and stays generic for an unknown one", () => {
    const reasons = [
      "TOKEN_INVALID",
      "CLAIM_REJECTED",
      "ALREADY_CLAIMED",
      "RATE_LIMITED",
      "UNREACHABLE",
      "TLS",
      "INTERNAL",
      "CERT_INVALID",
      "REVOKED",
    ];
    const seen = new Set<string>();
    for (const reason of reasons) {
      const text = serverStateText({ state: "failed", reason });
      expect(text).not.toContain(reason);
      seen.add(text);
    }
    expect(seen.size).toBe(reasons.length);
    const unknown: ServerState = { state: "failed", reason: "SOMETHING_NEW" };
    expect(serverStateText(unknown)).toContain("SOMETHING_NEW");
  });

  it("knows which failures need a new registration", () => {
    expect(NEEDS_NEW_REGISTRATION).toEqual(["CERT_INVALID", "REVOKED"]);
  });
});
