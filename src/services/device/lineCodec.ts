/** One line from the board: a protocol message (a JSON object) or a log line. */
export type Line =
  | { kind: "msg"; text: string; msg: Record<string, unknown> }
  | { kind: "log"; text: string };

/** Longest line kept before it's flushed as a log line, so a board without newlines can't grow memory forever. */
export const MAX_LINE = 16 * 1024;

/** Splits a byte stream into lines (jome-farmer/protocol §2). Handles chunks cut mid-line and mid-UTF-8 character. */
export class LineDecoder {
  private decoder = new TextDecoder("utf-8");
  private buffer = "";

  push(bytes: Uint8Array): Line[] {
    this.buffer += this.decoder.decode(bytes, { stream: true });
    const parts = this.buffer.split("\n");
    this.buffer = parts.pop() ?? "";
    if (this.buffer.length > MAX_LINE) {
      parts.push(this.buffer);
      this.buffer = "";
    }
    return parts
      .map((p) => p.replace(/\r/g, ""))
      .filter(Boolean)
      .map(classify);
  }
}

export function classify(text: string): Line {
  if (text.startsWith("{")) {
    try {
      const msg: unknown = JSON.parse(text);
      if (msg && typeof msg === "object" && !Array.isArray(msg)) {
        return { kind: "msg", text, msg: msg as Record<string, unknown> };
      }
    } catch {
      // A log line that happens to start with "{": show it, don't fail.
    }
  }
  return { kind: "log", text };
}

const encoder = new TextEncoder();

export function encodeLine(text: string): Uint8Array {
  return encoder.encode(text + "\n");
}
