import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Copy, SendHorizontal } from "lucide-react";
import { useDevice } from "../../device/DeviceContext";
import type { LinkKind } from "../../device/link";
import { appendCapped, clock, toPlainText, type TermLine } from "./lines";
import styles from "./TerminalScreen.module.css";
import { errorText } from "../../device/errors";

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const LINK_LABEL: Record<LinkKind, string> = {
  ble: "Bluetooth",
  usb: "USB",
  mock: "Demo",
};

/** Raw serial view of whatever link is connected: firmware logs plus app ↔ board protocol. */
export function TerminalScreen() {
  const navigate = useNavigate();
  const { state, client, linkKind, baudRate, setBaudRate } = useDevice();
  const [lines, setLines] = useState<TermLine[]>([]);
  const [showProtocol, setShowProtocol] = useState(true);
  const [timestamps, setTimestamps] = useState(false);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [sendError, setSendError] = useState<string>();

  // Batch incoming lines into one render per frame; boards can log hundreds of lines a second.
  const pending = useRef<TermLine[]>([]);
  const frame = useRef<number | undefined>(undefined);
  const nextId = useRef(0);
  useEffect(() => {
    if (!client) return;
    const off = client.onLine((l) => {
      pending.current.push({ ...l, id: nextId.current++, at: Date.now() });
      frame.current ??= requestAnimationFrame(() => {
        frame.current = undefined;
        const add = pending.current;
        pending.current = [];
        setLines((ls) => appendCapped(ls, add));
      });
    });
    return () => {
      off();
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      frame.current = undefined;
    };
  }, [client]);

  // Follow new output unless the user scrolled up to read.
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines, showProtocol, timestamps]);

  const visible = showProtocol ? lines : lines.filter((l) => l.kind === "log");

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!client || !input) return;
    setSendError(undefined);
    client.writeRaw(input).catch((err: unknown) => {
      setSendError(errorText(err));
    });
    setInput("");
    stick.current = true;
  };

  const copy = () => {
    navigator.clipboard
      .writeText(toPlainText(visible, timestamps))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setSendError("Couldn't copy. Select the text instead."));
  };

  const connected = state === "ready" && client && linkKind;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={22} aria-hidden />
        </button>
        <h1 className={styles.title}>Serial terminal</h1>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={copied ? "Copied" : "Copy output"}
          onClick={copy}
          disabled={!visible.length}
        >
          {copied ? (
            <Check size={22} aria-hidden />
          ) : (
            <Copy size={22} aria-hidden />
          )}
        </button>
      </header>

      {connected ? (
        <>
          <div className={styles.chips}>
            {linkKind === "usb" && baudRate ? (
              <label className={`${styles.chip} ${styles.on}`}>
                USB ·
                <select
                  id="baud"
                  className={styles.baud}
                  value={baudRate}
                  onChange={(e) => void setBaudRate(Number(e.target.value))}
                  aria-label="Baud rate"
                >
                  {BAUD_RATES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className={`${styles.chip} ${styles.on}`}>
                {LINK_LABEL[linkKind]}
              </span>
            )}
            <button
              type="button"
              className={`${styles.chip} ${showProtocol ? styles.on : ""}`}
              aria-pressed={showProtocol}
              onClick={() => setShowProtocol((v) => !v)}
            >
              Protocol
            </button>
            <button
              type="button"
              className={`${styles.chip} ${timestamps ? styles.on : ""}`}
              aria-pressed={timestamps}
              onClick={() => setTimestamps((v) => !v)}
            >
              Timestamps
            </button>
            <button
              type="button"
              className={styles.chip}
              onClick={() => setLines([])}
            >
              Clear
            </button>
          </div>

          <div
            ref={scroller}
            className={styles.console}
            role="log"
            aria-label="Terminal output"
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
          >
            {visible.length === 0 && (
              <p className={styles.hint}>
                Waiting for output. Type a command below or run a zone.
              </p>
            )}
            {visible.map((l) => (
              <p
                key={l.id}
                className={
                  l.dir === "tx"
                    ? styles.tx
                    : l.kind === "msg"
                      ? styles.rx
                      : undefined
                }
              >
                {timestamps && <span className={styles.ts}>{clock(l.at)}</span>}
                {l.dir === "tx" ? "→ " : l.kind === "msg" ? "← " : ""}
                {l.text}
              </p>
            ))}
          </div>

          {sendError && (
            <p className={styles.error} role="alert">
              {sendError}
            </p>
          )}
          <form className={styles.inputBar} onSubmit={send}>
            <input
              id="terminal-input"
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a command"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="send"
              aria-label="Command"
            />
            <button
              type="submit"
              className={styles.send}
              aria-label="Send"
              disabled={!input}
            >
              <SendHorizontal size={22} aria-hidden />
            </button>
          </form>
        </>
      ) : (
        <p className={styles.hint}>
          Connect to a controller on the Device tab to see its serial output.
        </p>
      )}
    </main>
  );
}
