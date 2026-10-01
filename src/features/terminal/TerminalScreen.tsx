import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Copy, SendHorizontal } from "lucide-react";
import { useDeviceClient } from "../../device/hooks";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectDevice, setBaudRate } from "../../store/deviceSlice";
import type { LinkKind } from "../../services/device/links/link";
import { appendCapped, clock, toPlainText, type TermLine } from "./lines";
import styles from "./TerminalScreen.module.css";
import { errorText } from "../../services/device/errors";
import { parseTerminalCommand } from "./commands";
import { terminalBanner } from "./banner";
import { formatWifiState } from "./status";
import { formatZones } from "./zones";

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const LINK_LABEL: Record<LinkKind, string> = {
  ble: "Bluetooth",
  usb: "USB",
  mock: "Demo",
  cloud: "Internet",
};

/** Friendly shell and raw serial view of whatever link is connected. */
export function TerminalScreen() {
  const navigate = useNavigate();
  const { state, info, linkKind, baudRate } = useAppSelector(selectDevice);
  const client = useDeviceClient();
  const dispatch = useAppDispatch();
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
    if (linkKind) {
      const text = terminalBanner(info, linkKind);
      setLines((ls) =>
        appendCapped(ls, [
          {
            dir: "rx",
            kind: "log",
            text,
            id: nextId.current++,
            at: Date.now(),
          },
        ]),
      );
    }
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
  }, [client, info, linkKind]);

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
    const parsed = parseTerminalCommand(input);
    if (parsed.type === "error") {
      setSendError(parsed.text);
    } else if (parsed.type === "local") {
      setLines((ls) =>
        appendCapped(ls, [
          {
            dir: "rx",
            kind: "log",
            text: parsed.text,
            id: nextId.current++,
            at: Date.now(),
          },
        ]),
      );
    } else if (parsed.command.cmd === "status") {
      client.request("status", {}).then(
        (status) => {
          setLines((ls) =>
            appendCapped(ls, [
              {
                dir: "rx",
                kind: "log",
                text: formatWifiState(status.wifi),
                id: nextId.current++,
                at: Date.now(),
              },
            ]),
          );
        },
        (err: unknown) => setSendError(errorText(err)),
      );
    } else if (parsed.command.cmd === "zones.list") {
      client.request("zones.list", {}).then(
        ({ zones }) => {
          setLines((ls) =>
            appendCapped(ls, [
              {
                dir: "rx",
                kind: "log",
                text: formatZones(zones),
                id: nextId.current++,
                at: Date.now(),
              },
            ]),
          );
        },
        (err: unknown) => setSendError(errorText(err)),
      );
    } else {
      client
        .request(parsed.command.cmd, parsed.command.args)
        .catch((err: unknown) => {
          setSendError(errorText(err));
        });
    }
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
          data-tap
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={22} aria-hidden />
        </button>
        <h1 className={styles.title}>Serial terminal</h1>
        <button
          type="button"
          className={styles.iconBtn}
          data-tap
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
                  onChange={(e) =>
                    void dispatch(setBaudRate(Number(e.target.value)))
                  }
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
              data-tap
              className={`${styles.chip} ${showProtocol ? styles.on : ""}`}
              aria-pressed={showProtocol}
              onClick={() => setShowProtocol((v) => !v)}
            >
              Protocol
            </button>
            <button
              type="button"
              data-tap
              className={`${styles.chip} ${timestamps ? styles.on : ""}`}
              aria-pressed={timestamps}
              onClick={() => setTimestamps((v) => !v)}
            >
              Timestamps
            </button>
            <button
              type="button"
              data-tap
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
              <p className={styles.hint}>Type help to see terminal commands.</p>
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
              placeholder="Type help or a command"
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
