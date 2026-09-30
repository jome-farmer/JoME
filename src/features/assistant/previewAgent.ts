import type { Status, Zone } from "../../device/types";
import { formatClock, formatDuration, whenLabel } from "../../lib/format";
import type {
  AgentContext,
  AgentEvent,
  AgentSession,
  ToolResult,
} from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The zone whose name best matches the message ("water the vegetable beds" → Vegetable beds). */
export function findZone(text: string, zones: Zone[]): Zone | undefined {
  const words = text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  let best: { zone: Zone; score: number } | undefined;
  for (const zone of zones) {
    const score = zone.name
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => words.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { zone, score };
  }
  return best?.zone;
}

/**
 * ponytail: a scripted stand-in for the JoME agent until #22 connects the real one.
 * It speaks the same contract (text, sources, tool calls, tool results), so the chat,
 * the action cards and the safety tiers are exercised for real. The screen labels it
 * "Preview", and it never pretends to have outside data: its insight uses the board's own status.
 */
export function createPreviewAgent(delayMs = 20): AgentSession {
  const waiting = new Map<string, (r: ToolResult) => void>();
  let calls = 0;

  return {
    toolResult(callId, result) {
      waiting.get(callId)?.(result);
      waiting.delete(callId);
    },

    async insight(ctx) {
      const next = ctx.status?.nextRun;
      if (ctx.status?.running[0]) {
        const r = ctx.status.running[0];
        const zone = ctx.zones.find((z) => z.zone === r.zone);
        return `${zone?.name ?? `Zone ${r.zone}`} is watering now, ${formatClock(r.remaining)} left.`;
      }
      return next
        ? `Next watering: ${next.name}, ${whenLabel(next.at, new Date())}.`
        : "No programs are scheduled. Ask me to help you set one up.";
    },

    async send(text, ctx, on) {
      const say = async (words: string) => {
        for (const piece of words.match(/\S+\s*/g) ?? []) {
          on({ type: "text", text: piece });
          await sleep(delayMs);
        }
      };
      const call = (name: string, args: Record<string, unknown> = {}) =>
        new Promise<ToolResult>((resolve) => {
          const callId = `preview-${++calls}`;
          waiting.set(callId, resolve);
          on({ type: "tool.call", call: { callId, name, args } });
        });
      const outcome = async (r: ToolResult, done: string) => {
        if (r.ok) return say(done);
        if (r.error.code === "USER_DECLINED")
          return say("Okay, I've left everything as it is.");
        if (r.error.code === "TIMEOUT")
          return say("No problem, I didn't change anything.");
        return say(`That didn't work: ${r.error.message}`);
      };

      await sleep(delayMs * 10);
      const t = text.toLowerCase();
      const zone = findZone(t, ctx.zones);

      if (/\bstop\b/.test(t)) {
        const r =
          zone && !/\ball\b/.test(t)
            ? await call("stop_zone", { zone: zone.zone })
            : await call("stop_all");
        return outcome(
          r,
          zone && !/\ball\b/.test(t)
            ? `I've stopped ${zone.name}.`
            : "I've stopped all watering.",
        );
      }

      if (/rain/.test(t)) {
        on({ type: "status", text: "Checking the controller…" });
        await call("get_status");
        await call("list_programs");
        await say(
          "If rain is on the way, pausing the programs saves water. A day of steady rain covers most lawns and beds, so I'd pause for 24 hours. ",
        );
        on({
          type: "source",
          source: {
            id: "s1",
            title: "Watering after rain",
            publisher: "Preview guide",
          },
        });
        const r = await call("set_rain_delay", { hours: 24 });
        return outcome(
          r,
          "Done. Programs will skip their runs for the next 24 hours.",
        );
      }

      if (zone && /\b(water|run|start|irrigate)\b/.test(t)) {
        const minutes = Number(t.match(/(\d+)\s*(min|minutes?)\b/)?.[1]);
        const seconds = minutes ? minutes * 60 : zone.defaultSeconds;
        await say(`I can water ${zone.name} for ${formatDuration(seconds)}. `);
        const r = await call("run_zone", { zone: zone.zone, seconds });
        return outcome(
          r,
          `${zone.name} is watering now. You'll see it counting down on Home.`,
        );
      }

      if (/\b(running|status|watering now|what'?s on)\b/.test(t)) {
        const r = await call("get_status");
        const s = r.ok ? (r.data as Status) : undefined;
        const run = s?.running[0];
        const name = (n: number) =>
          ctx.zones.find((z) => z.zone === n)?.name ?? `Zone ${n}`;
        return say(
          run
            ? `${name(run.zone)} is watering, with ${formatClock(run.remaining)} left.`
            : s?.nextRun
              ? `Nothing is watering right now. Next up: ${s.nextRun.name}, ${whenLabel(s.nextRun.at, new Date())}.`
              : "Nothing is watering, and no programs are scheduled.",
        );
      }

      if (/yellow|leaves|tomato|wilt/.test(t)) {
        on({
          type: "source",
          source: {
            id: "s2",
            title: "Diagnosing yellow leaves",
            publisher: "Preview guide",
          },
        });
        return say(
          "Yellow leaves most often come from too much water, especially if the soil stays wet and the lower leaves yellow first. " +
            "If the soil is dry, it's more likely thirst or a lack of nitrogen. Check the soil a finger-length down before changing the schedule.",
        );
      }

      return say(
        "In this preview I can check the controller, run or stop a zone, and set a rain delay. " +
          `Try "Water the ${ctx.zones[0]?.name.toLowerCase() ?? "lawn"} for 10 min" or "Rain is coming tonight".`,
      );
    },
  };
}

export type { AgentEvent, AgentContext };
