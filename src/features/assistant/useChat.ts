import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceClient } from "../../device/client";
import type { Program, Zone } from "../../device/types";
import { CONFIRM_TIMEOUT_MS, planTool, type Plan } from "./tools";
import type {
  AgentContext,
  AgentSession,
  Source,
  ToolCall,
  ToolResult,
} from "./types";
import { errorText } from "../../device/errors";

export type CardState =
  "pending" | "running" | "done" | "declined" | "failed" | "expired";

export type Part =
  | { kind: "text"; text: string }
  | { kind: "trace"; items: string[] }
  | { kind: "sources"; sources: Source[] }
  | { kind: "refused"; text: string }
  | {
      kind: "card";
      id: string;
      tier: "stop" | "act";
      summary: string;
      detail?: string;
      water?: boolean;
      state: CardState;
      message?: string;
    };

export type Message =
  | { id: number; role: "user"; text: string }
  | {
      id: number;
      role: "assistant";
      parts: Part[];
      status?: string;
      done: boolean;
    };

type Pending = {
  plan: Extract<Plan, { ok: true }>;
  call: ToolCall;
  timer: ReturnType<typeof setTimeout>;
};

const errorOf = (e: unknown) => ({
  code: (e as { code?: string })?.code ?? "INTERNAL",
  message: e instanceof Error ? e.message : String(e),
});

/**
 * The chat: sends turns to the agent and routes every tool call through planTool.
 * read/stop run on their own; act waits for Confirm (or Cancel, or expires after 2 min).
 */
export function useChat(
  agent: AgentSession,
  client: DeviceClient | undefined,
  context: () => AgentContext,
  data: { zones: Zone[]; programs: Program[]; canMoveValve?: boolean },
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const pending = useRef(new Map<string, Pending>());
  const dataRef = useRef(data);
  dataRef.current = data;

  /** Apply a change to the assistant message being written. */
  const edit = useCallback(
    (fn: (m: Extract<Message, { role: "assistant" }>) => void) => {
      setMessages((ms) => {
        const last = ms[ms.length - 1];
        if (!last || last.role !== "assistant") return ms;
        const copy = {
          ...last,
          parts: last.parts.map((p) => ({ ...p })),
        } as Extract<Message, { role: "assistant" }>;
        fn(copy);
        return [...ms.slice(0, -1), copy];
      });
    },
    [],
  );

  const setCard = useCallback(
    (id: string, patch: Partial<Extract<Part, { kind: "card" }>>) =>
      setMessages((ms) =>
        ms.map((m) =>
          m.role !== "assistant"
            ? m
            : {
                ...m,
                parts: m.parts.map((p) =>
                  p.kind === "card" && p.id === id ? { ...p, ...patch } : p,
                ),
              },
        ),
      ),
    [],
  );

  const execute = useCallback(
    async (id: string, plan: Extract<Plan, { ok: true }>, call: ToolCall) => {
      if (!client) {
        const result: ToolResult = {
          ok: false,
          error: {
            code: "NO_DEVICE",
            message: "Connect to your JoME to let me do that.",
          },
        };
        setCard(id, { state: "failed", message: result.error.message });
        return agent.toolResult(call.callId, result);
      }
      setCard(id, { state: "running" });
      try {
        const data = await plan.run(client);
        setCard(id, { state: "done" });
        agent.toolResult(call.callId, { ok: true, data });
      } catch (e) {
        const error = errorOf(e);
        // People see the app's words; the agent gets the code and the board's message.
        setCard(id, { state: "failed", message: errorText(e) });
        agent.toolResult(call.callId, { ok: false, error });
      }
    },
    [agent, client, setCard],
  );

  const onToolCall = useCallback(
    async (call: ToolCall) => {
      const plan = planTool(call.name, call.args, {
        ...dataRef.current,
        now: new Date(),
      });
      if (!plan.ok) {
        edit((m) =>
          m.parts.push({
            kind: "refused",
            text: `Couldn't do that: ${plan.message}`,
          }),
        );
        return agent.toolResult(call.callId, {
          ok: false,
          error: { code: plan.code, message: plan.message },
        });
      }
      if (plan.tier === "read") {
        edit((m) => {
          const last = m.parts[m.parts.length - 1];
          if (last?.kind === "trace")
            last.items = [...last.items, plan.summary];
          else m.parts.push({ kind: "trace", items: [plan.summary] });
        });
        if (!client)
          return agent.toolResult(call.callId, {
            ok: false,
            error: { code: "NO_DEVICE", message: "Not connected" },
          });
        try {
          agent.toolResult(call.callId, {
            ok: true,
            data: await plan.run(client),
          });
        } catch (e) {
          agent.toolResult(call.callId, { ok: false, error: errorOf(e) });
        }
        return;
      }
      const id = call.callId;
      edit((m) =>
        m.parts.push({
          kind: "card",
          id,
          tier: plan.tier as "stop" | "act",
          summary: plan.summary,
          detail: plan.detail,
          water: plan.water,
          state: plan.tier === "stop" ? "running" : "pending",
        }),
      );
      // Stopping water is always safe: run it without asking.
      if (plan.tier === "stop") return execute(id, plan, call);
      const timer = setTimeout(() => {
        if (!pending.current.delete(id)) return;
        setCard(id, { state: "expired" });
        agent.toolResult(call.callId, {
          ok: false,
          error: { code: "TIMEOUT", message: "Not confirmed in time" },
        });
      }, CONFIRM_TIMEOUT_MS);
      pending.current.set(id, { plan, call, timer });
    },
    [agent, client, edit, execute, setCard],
  );

  const confirm = useCallback(
    (id: string) => {
      const p = pending.current.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.current.delete(id);
      void execute(id, p.plan, p.call);
    },
    [execute],
  );

  const cancel = useCallback(
    (id: string) => {
      const p = pending.current.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.current.delete(id);
      setCard(id, { state: "declined" });
      agent.toolResult(p.call.callId, {
        ok: false,
        error: { code: "USER_DECLINED", message: "User tapped Cancel" },
      });
    },
    [agent, setCard],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      setMessages((ms) => [
        ...ms,
        { id: nextId.current++, role: "user", text: trimmed },
        { id: nextId.current++, role: "assistant", parts: [], done: false },
      ]);
      try {
        await agent.send(trimmed, context(), (e) => {
          if (e.type === "text")
            edit((m) => {
              m.status = undefined;
              const last = m.parts[m.parts.length - 1];
              if (last?.kind === "text") last.text += e.text;
              else m.parts.push({ kind: "text", text: e.text });
            });
          else if (e.type === "status") edit((m) => void (m.status = e.text));
          else if (e.type === "source")
            edit((m) => {
              const last = m.parts[m.parts.length - 1];
              if (last?.kind === "sources")
                last.sources = [...last.sources, e.source];
              else m.parts.push({ kind: "sources", sources: [e.source] });
            });
          else if (e.type === "tool.call") void onToolCall(e.call);
          else if (e.type === "error")
            edit((m) => m.parts.push({ kind: "refused", text: e.message }));
        });
      } catch (e) {
        edit((m) =>
          m.parts.push({
            kind: "refused",
            text: `JoME couldn't answer. ${errorOf(e).message}`,
          }),
        );
      } finally {
        edit((m) => {
          m.done = true;
          m.status = undefined;
        });
        setBusy(false);
      }
    },
    [agent, busy, context, edit, onToolCall],
  );

  const reset = useCallback(() => {
    for (const p of pending.current.values()) clearTimeout(p.timer);
    pending.current.clear();
    setMessages([]);
  }, []);

  // Leaving the screen cancels anything still waiting for Confirm.
  useEffect(() => {
    const map = pending.current;
    return () => map.forEach((p) => clearTimeout(p.timer));
  }, []);

  return { messages, busy, send, confirm, cancel, reset };
}
