import { describe, expect, it } from "vitest";
import { parseTerminalCommand } from "./commands";

describe("parseTerminalCommand", () => {
  it("maps friendly commands to protocol commands", () => {
    expect(parseTerminalCommand("run 2 10m")).toEqual({
      type: "command",
      command: { cmd: "zone.run", args: { zone: 2, seconds: 600 } },
    });
    expect(parseTerminalCommand("stop")).toEqual({
      type: "command",
      command: { cmd: "stop.all", args: {} },
    });
  });

  it("keeps help local and rejects invalid input", () => {
    expect(parseTerminalCommand("help")).toMatchObject({ type: "local" });
    expect(parseTerminalCommand("run 2")).toEqual({
      type: "error",
      text: "Usage: run <zone> <time> (for example, run 2 10m)",
    });
    expect(parseTerminalCommand("wat")).toEqual({
      type: "error",
      text: "Unknown command: wat. Try help.",
    });
  });
});
