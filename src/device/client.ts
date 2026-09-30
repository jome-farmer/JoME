import type { Link } from "./link";
import { encodeLine, LineDecoder, type Line } from "./lineCodec";
import type {
  Args,
  Command,
  ErrorCode,
  EventName,
  Events,
  Result,
} from "./types";

export class DeviceError extends Error {
  constructor(
    readonly code: ErrorCode | string,
    message: string,
  ) {
    super(message);
    this.name = "DeviceError";
  }
}

/** Every line on the wire, for the terminal. rx = from the board, tx = from the app. */
export type TrafficLine = {
  dir: "rx" | "tx";
  kind: Line["kind"];
  text: string;
};

const DEFAULT_TIMEOUT = 5_000;
const TIMEOUTS: Partial<Record<Command, number>> = { "wifi.scan": 15_000 };

type Pending = {
  resolve: (data: unknown) => void;
  reject: (err: DeviceError) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** Typed request/response and events over any Link (device-protocol.md §3). */
export class DeviceClient {
  private decoder = new LineDecoder();
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private eventSubs = new Map<string, Set<(data: never) => void>>();
  private lineSubs = new Set<(line: TrafficLine) => void>();
  private writing: Promise<void> = Promise.resolve();
  private unsubs: (() => void)[];

  constructor(private readonly link: Link) {
    this.unsubs = [
      link.onData((bytes) =>
        this.decoder.push(bytes).forEach((l) => this.receive(l)),
      ),
      link.onClose(() =>
        this.failAll("LINK_CLOSED", "The connection to JoME closed"),
      ),
    ];
  }

  request<C extends Command>(
    cmd: C,
    args: Args<C>,
    timeoutMs?: number,
  ): Promise<Result<C>> {
    const id = this.nextId++;
    const ms = timeoutMs ?? TIMEOUTS[cmd] ?? DEFAULT_TIMEOUT;
    const result = new Promise<Result<C>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new DeviceError(
            "TIMEOUT",
            `JoME didn't answer "${cmd}" in ${ms / 1000} s`,
          ),
        );
      }, ms);
      this.pending.set(id, {
        resolve: resolve as (d: unknown) => void,
        reject,
        timer,
      });
    });
    this.send(JSON.stringify({ id, cmd, args })).catch((err: unknown) => {
      this.settle(id, (p) =>
        p.reject(new DeviceError("LINK_CLOSED", String(err))),
      );
    });
    return result;
  }

  on<E extends EventName>(evt: E, cb: (data: Events[E]) => void): () => void {
    const subs = this.eventSubs.get(evt) ?? new Set();
    this.eventSubs.set(evt, subs);
    subs.add(cb as (data: never) => void);
    return () => subs.delete(cb as (data: never) => void);
  }

  /** Every rx/tx line, protocol and log. */
  onLine(cb: (line: TrafficLine) => void): () => void {
    this.lineSubs.add(cb);
    return () => this.lineSubs.delete(cb);
  }

  /** Send text typed in the terminal, unchanged. */
  writeRaw(text: string): Promise<void> {
    return this.send(text);
  }

  dispose(): void {
    this.unsubs.forEach((u) => u());
    this.failAll("LINK_CLOSED", "Disconnected");
  }

  private send(text: string): Promise<void> {
    this.emitLine({
      dir: "tx",
      kind: text.startsWith("{") ? "msg" : "log",
      text,
    });
    // Serialise writes: a BLE link splits each write into MTU chunks, which must not interleave.
    this.writing = this.writing
      .catch(() => {})
      .then(() => this.link.write(encodeLine(text)));
    return this.writing;
  }

  private receive(line: Line): void {
    this.emitLine({ dir: "rx", kind: line.kind, text: line.text });
    if (line.kind !== "msg") return;
    // ponytail: only the envelope is validated; payloads are trusted per the Commands types. Add per-command schemas if firmware versions diverge.
    const { id, ok, data, error, evt } = line.msg;
    if (typeof id === "number" && typeof ok === "boolean") {
      this.settle(id, (p) => {
        if (ok) return p.resolve(data ?? {});
        const e = (error ?? {}) as { code?: unknown; message?: unknown };
        p.reject(
          new DeviceError(
            String(e.code ?? "INTERNAL"),
            String(e.message ?? "JoME reported an error"),
          ),
        );
      });
    } else if (typeof evt === "string") {
      this.eventSubs.get(evt)?.forEach((cb) => cb(data as never));
    }
  }

  private settle(id: number, fn: (p: Pending) => void): void {
    const p = this.pending.get(id);
    if (!p) return; // Late answer after a timeout, or not ours.
    clearTimeout(p.timer);
    this.pending.delete(id);
    fn(p);
  }

  private failAll(code: ErrorCode, message: string): void {
    for (const id of [...this.pending.keys()]) {
      this.settle(id, (p) => p.reject(new DeviceError(code, message)));
    }
  }

  private emitLine(line: TrafficLine): void {
    this.lineSubs.forEach((cb) => cb(line));
  }
}
