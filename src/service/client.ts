/** HTTP and event-stream client for the JoME server, DouSHamBE (docs/cloud.md). */

import { reconnectDelay } from "../lib/backoff";

export const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

/**
 * A failed call. `code` is the server's (or the board's, passed through), so
 * errorText() can word it; `NETWORK` means the server couldn't be reached.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let token: string | undefined;
let unauthorized: ((rejected: string) => void) | undefined;

/** Set after sign-in and cleared on sign-out. Sent as a bearer token on every call. */
export function setToken(accessToken: string | undefined): void {
  token = accessToken;
}

/** Called with the token the server rejected (401): that session expired or was revoked. */
export function onUnauthorized(
  cb: ((rejected: string) => void) | undefined,
): void {
  unauthorized = cb;
}

type Options = {
  method?: "GET" | "POST" | "DELETE";
  /** Sent as JSON. */
  body?: unknown;
  signal?: AbortSignal;
  accept?: string;
};

/** fetch with auth; throws ApiError unless the response is 2xx. */
export async function send(
  path: string,
  { method = "GET", body, signal, accept = "application/json" }: Options = {},
): Promise<Response> {
  const sent = token;
  const headers: Record<string, string> = { Accept: accept };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (sent) headers.Authorization = `Bearer ${sent}`;

  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ApiError("NETWORK", "Couldn't reach the JoME server.", 0);
  }
  if (res.ok) return res;
  if (res.status === 401 && sent) unauthorized?.(sent);

  const error = (
    (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null
  )?.error;
  throw new ApiError(
    error?.code ?? `HTTP_${res.status}`,
    error?.message ?? (res.statusText || `HTTP ${res.status}`),
    res.status,
  );
}

/** A JSON call: `api<Session>("/v1/auth/otp/verify", { method: "POST", body })`. */
export async function api<T>(path: string, options?: Options): Promise<T> {
  const res = await send(path, options);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** One server-sent event: a protocol event name (or `online`) and its parsed JSON `data` (docs/cloud.md). */
export type ServerEvent = { event: string; data: unknown };

/**
 * Parses a text/event-stream body. Comment lines (`: keepalive`) are skipped,
 * and so are events whose data isn't JSON.
 */
export async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerEvent> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let event = "message";
  let data: string[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value;
      const lines = buffer.split(/\r\n|\r|\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line === "") {
          if (data.length) {
            try {
              yield { event, data: JSON.parse(data.join("\n")) as unknown };
            } catch {
              // Not JSON: not something the contract sends, so drop it.
            }
          }
          event = "message";
          data = [];
        } else if (!line.startsWith(":")) {
          const colon = line.indexOf(":");
          const field = colon < 0 ? line : line.slice(0, colon);
          const value =
            colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "event") event = value;
          else if (field === "data") data.push(value);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

type Handlers = {
  onEvent(e: ServerEvent): void;
  /** Fires on every (re)connect: read the device again to catch up on what was missed. */
  onOpen?(): void;
  /** Gives up for good: signed out (401), or no such device for this account (403/404). */
  onError?(e: ApiError): void;
};

const FATAL = new Set([401, 403, 404]);

/**
 * Follows an SSE endpoint with the bearer token (EventSource can't send one).
 * Reconnects with backoff when the stream drops, until `signal` aborts.
 */
export function followEvents(
  path: string,
  handlers: Handlers,
  signal: AbortSignal,
): void {
  void (async () => {
    let attempt = 0;
    while (!signal.aborted) {
      try {
        const res = await send(path, { signal, accept: "text/event-stream" });
        if (!res.body) throw new ApiError("NETWORK", "No event stream.", 0);
        attempt = 0;
        handlers.onOpen?.();
        for await (const e of readEvents(res.body)) handlers.onEvent(e);
      } catch (e) {
        if (signal.aborted) return;
        if (e instanceof ApiError && FATAL.has(e.status)) {
          handlers.onError?.(e);
          return;
        }
      }
      await sleep(reconnectDelay(attempt++), signal);
    }
  })();
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}
