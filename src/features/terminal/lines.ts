import type { TrafficLine } from "../../device/client";

export type TermLine = TrafficLine & { id: number; at: number };

/** Keep the newest lines only, so a chatty board can't slow the app down over time. */
export const MAX_LINES = 2000;

export function appendCapped<T>(lines: T[], add: T[], max = MAX_LINES): T[] {
  const all = lines.concat(add);
  return all.length > max ? all.slice(all.length - max) : all;
}

export function clock(ms: number): string {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

/** What Copy puts on the clipboard: what's on screen, with → / ← marking app and board. */
export function toPlainText(lines: TermLine[], timestamps: boolean): string {
  return lines
    .map((l) => {
      const arrow = l.dir === "tx" ? "→ " : l.kind === "msg" ? "← " : "";
      return `${timestamps ? clock(l.at) + " " : ""}${arrow}${l.text}`;
    })
    .join("\n");
}
