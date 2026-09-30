import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Check,
  Play,
  Plug,
  Plus,
  SendHorizontal,
  Sprout,
} from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import { useGarden } from "../../device/useGarden";
import { getFlag, setFlag } from "../../lib/storage";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { IconButton } from "../../ui/IconButton";
import { Sheet } from "../../ui/Sheet";
import { StatusPill } from "../../ui/StatusPill";
import { ActionCard } from "./ActionCard";
import { createPreviewAgent } from "./previewAgent";
import type { AgentContext } from "./types";
import { useChat } from "./useChat";
import styles from "./Assistant.module.css";

const CONSENT_KEY = "assistantConsent.v1";
const SUGGESTIONS = [
  "What's watering right now?",
  "Rain is coming tonight, what should I do?",
  "Water the vegetable beds for 10 min",
  "Why are my tomato leaves turning yellow?",
];

/** Mockups 6 and 7: Ask JoME. Answers stream in; anything that changes the garden waits for Confirm. */
export function AssistantScreen() {
  const { state, client } = useDevice();
  const navigate = useNavigate();

  if (state !== "ready" || !client) {
    return (
      <main className={styles.screen}>
        <EmptyState
          title="Connect JoME first"
          action={
            <div className={styles.emptyActions}>
              <Button icon={Plug} onClick={() => navigate("/connect")}>
                Connect a controller
              </Button>
              <Button
                variant="ghost"
                icon={Play}
                onClick={() => navigate("/device")}
              >
                Try the demo
              </Button>
            </div>
          }
        >
          The assistant looks at your controller's zones and programs to answer
          you, and can make changes once you confirm them.
        </EmptyState>
      </main>
    );
  }
  return <Chat />;
}

function Chat() {
  const { info, client } = useDevice();
  const navigate = useNavigate();
  const garden = useGarden(client);
  // ponytail: preview agent until the real JoME agent is connected (#22).
  const agent = useMemo(() => createPreviewAgent(), []);
  const [consent, setConsent] = useState<boolean>();
  const [insight, setInsight] = useState<string>();
  const [input, setInput] = useState("");

  const context = useCallback(
    (): AgentContext => ({
      device: { serial: info!.serial, name: info!.name, fw: info!.fw },
      status: garden.status,
      zones: garden.zones,
      programs: garden.programs,
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    [info, garden.status, garden.zones, garden.programs],
  );
  const chat = useChat(agent, client, context, garden);

  useEffect(() => {
    void getFlag(CONSENT_KEY).then(setConsent);
  }, []);
  useEffect(() => {
    if (garden.status) void agent.insight?.(context()).then(setInsight);
  }, [agent, garden.status, context]);

  // Keep the newest message in view as it streams.
  const end = useRef<HTMLDivElement>(null);
  // Braces matter: newer browsers return a Promise from scrollIntoView, and an
  // effect may only return a cleanup function.
  useLayoutEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.messages]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void chat.send(input);
    setInput("");
  };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <img src="/logo/symbol.svg" alt="" className={styles.avatar} />
        <div className={styles.headText}>
          <h1 className={styles.title}>Ask JoME</h1>
          <StatusPill tone="idle">Preview · answers are simulated</StatusPill>
        </div>
        {chat.messages.length > 0 && (
          <IconButton
            icon={Plus}
            label="New chat"
            onClick={chat.reset}
            disabled={chat.busy}
          />
        )}
      </header>

      {chat.messages.length === 0 ? (
        <section className={styles.start}>
          <span className={styles.ctx}>
            <Sprout size={14} aria-hidden /> Looking at {info?.name} ·{" "}
            {garden.zones.length} zones
          </span>
          {insight && (
            <Card className={styles.insight}>
              <span className={styles.label}>Right now</span>
              <p>{insight}</p>
            </Card>
          )}
          <span className={styles.label}>Try asking</span>
          <div className={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.suggestion}
                onClick={() => void chat.send(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.chat} aria-live="polite">
          {chat.messages.map((m) =>
            m.role === "user" ? (
              <p key={m.id} className={styles.user}>
                {m.text}
              </p>
            ) : (
              <div key={m.id} className={styles.ai}>
                {m.parts.map((p, i) =>
                  p.kind === "text" ? (
                    <p key={i}>{p.text}</p>
                  ) : p.kind === "trace" ? (
                    <span key={i} className={styles.trace}>
                      <Check size={14} aria-hidden /> Checked{" "}
                      {p.items.join(", ")}
                    </span>
                  ) : p.kind === "sources" ? (
                    <div key={i} className={styles.sources}>
                      {p.sources.map((s) => (
                        <span key={s.id} className={styles.source}>
                          <BookOpen size={12} aria-hidden /> {s.title} ·{" "}
                          {s.publisher}
                        </span>
                      ))}
                    </div>
                  ) : p.kind === "refused" ? (
                    <p key={i} className={styles.refused} role="alert">
                      {p.text}
                    </p>
                  ) : (
                    <ActionCard
                      key={p.id}
                      card={p}
                      onConfirm={() => chat.confirm(p.id)}
                      onCancel={() => chat.cancel(p.id)}
                    />
                  ),
                )}
                {!m.done && (
                  <StatusPill tone="idle" live>
                    {m.status ?? "Thinking…"}
                  </StatusPill>
                )}
              </div>
            ),
          )}
          <div ref={end} />
        </section>
      )}

      <form className={styles.composer} onSubmit={submit}>
        <input
          id="ask-jome"
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            chat.messages.length ? "Reply…" : "Ask about your garden…"
          }
          aria-label="Message JoME"
          enterKeyHint="send"
          disabled={chat.busy}
        />
        <button
          type="submit"
          className={styles.send}
          aria-label="Send"
          disabled={!input.trim() || chat.busy}
        >
          <SendHorizontal size={20} aria-hidden />
        </button>
      </form>

      <Sheet
        open={consent === false}
        onClose={() => navigate("/", { replace: true })}
        title="Before you ask JoME"
      >
        <p className={styles.sheetText}>
          When the JoME assistant is connected, your messages and a snapshot of
          this controller (its zones, programs and status) are sent to JoME's
          servers so it can answer. It never changes anything without your
          Confirm. Stopping water is the only thing it does by itself.
        </p>
        <p className={styles.sheetText}>
          In this preview, nothing leaves your phone.
        </p>
        <Button
          size="lg"
          block
          onClick={() => {
            setConsent(true);
            void setFlag(CONSENT_KEY, true);
          }}
        >
          Continue
        </Button>
        <Button
          variant="ghost"
          block
          onClick={() => navigate("/", { replace: true })}
        >
          Not now
        </Button>
      </Sheet>
    </main>
  );
}
