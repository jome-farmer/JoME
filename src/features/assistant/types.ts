// App ↔ agent contract (docs/assistant.md). The real SSE transport arrives with #22.
import type { Hello, Program, Status, Zone } from "../../services/device/types";

export type ToolCall = {
  callId: string;
  name: string;
  args: Record<string, unknown>;
};

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: { code: string; message: string } };

export type Source = {
  id: string;
  title: string;
  publisher: string;
  url?: string;
};

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "status"; text: string }
  | { type: "source"; source: Source }
  | { type: "tool.call"; call: ToolCall }
  | { type: "error"; code: string; message: string };

/** Fresh snapshot sent with every turn, so the agent reasons about the real board. */
export type AgentContext = {
  device: Pick<Hello, "serial" | "name" | "fw">;
  status?: Status;
  zones: Zone[];
  programs: Program[];
  locale: string;
  timezone: string;
};

export interface AgentSession {
  /** Streams events for one turn; resolves when the turn is done. */
  send(
    text: string,
    context: AgentContext,
    onEvent: (e: AgentEvent) => void,
  ): Promise<void>;
  /** Answer a tool.call; the agent continues the turn with it. */
  toolResult(callId: string, result: ToolResult): void;
  /** Shown on the start screen; undefined when the agent has nothing to say. */
  insight?(context: AgentContext): Promise<string | undefined>;
}
