import { describe, expect, it } from "vitest";
import type { Zone } from "../../device/types";
import { createPreviewAgent, findZone } from "./previewAgent";
import type { AgentContext, AgentEvent } from "./types";

const zones: Zone[] = [
  {
    zone: 1,
    name: "Front lawn",
    valve: 1,
    enabled: true,
    defaultSeconds: 1200,
  },
  {
    zone: 3,
    name: "Vegetable beds",
    valve: 5,
    enabled: true,
    defaultSeconds: 600,
  },
];
const ctx: AgentContext = {
  device: { serial: "JM-DEMO-0001", name: "Demo garden", fw: "1.4.2" },
  zones,
  programs: [],
  locale: "en",
  timezone: "UTC",
};

/** Runs one turn, answering each tool call with `answer`. */
async function turn(text: string, answer: (name: string) => { ok: boolean }) {
  const agent = createPreviewAgent(0);
  const events: AgentEvent[] = [];
  await agent.send(text, ctx, (e) => {
    events.push(e);
    if (e.type === "tool.call") {
      const a = answer(e.call.name);
      agent.toolResult(
        e.call.callId,
        a.ok
          ? { ok: true, data: { running: [] } }
          : { ok: false, error: { code: "USER_DECLINED", message: "" } },
      );
    }
  });
  const text_ = events
    .flatMap((e) => (e.type === "text" ? [e.text] : []))
    .join("");
  const tools = events.flatMap((e) => (e.type === "tool.call" ? [e.call] : []));
  return { text: text_, tools };
}

describe("preview agent", () => {
  it("matches zones by name", () => {
    expect(findZone("please water the vegetable beds", zones)?.zone).toBe(3);
    expect(findZone("water the roses", zones)).toBeUndefined();
  });

  it("proposes run_zone with the asked duration and reacts to the result", async () => {
    const ok = await turn("Water the front lawn for 15 min", () => ({
      ok: true,
    }));
    expect(ok.tools).toEqual([
      expect.objectContaining({
        name: "run_zone",
        args: { zone: 1, seconds: 900 },
      }),
    ]);
    expect(ok.text).toContain("Front lawn is watering now");

    const declined = await turn("Water the front lawn", () => ({ ok: false }));
    expect(declined.text).toContain("left everything as it is");
  });

  it("reads before proposing a rain delay", async () => {
    const r = await turn("Rain is coming tonight, what should I do?", () => ({
      ok: true,
    }));
    expect(r.tools.map((t) => t.name)).toEqual([
      "get_status",
      "list_programs",
      "set_rain_delay",
    ]);
  });

  it("stops everything on request", async () => {
    const r = await turn("stop all watering", () => ({ ok: true }));
    expect(r.tools.map((t) => t.name)).toEqual(["stop_all"]);
  });
});
