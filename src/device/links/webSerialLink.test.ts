import { describe, expect, it } from "vitest";
import { createWebSerialLink } from "./webSerialLink";

/** A SerialPort double built on real web streams, so the read loop runs as in Chrome. */
function fakePort() {
  let feed!: ReadableStreamDefaultController<Uint8Array>;
  const written: string[] = [];
  const calls: string[] = [];
  const port = {
    readable: null as ReadableStream<Uint8Array> | null,
    writable: null as WritableStream<Uint8Array> | null,
    async open(opts: SerialOptions) {
      calls.push(`open ${opts.baudRate}`);
      port.readable = new ReadableStream({ start: (c) => void (feed = c) });
      port.writable = new WritableStream({
        write: (chunk) => void written.push(new TextDecoder().decode(chunk)),
      });
    },
    async close() {
      calls.push("close");
    },
  };
  return {
    port: port as unknown as SerialPort,
    written,
    calls,
    send: (s: string) => feed.enqueue(new TextEncoder().encode(s)),
    unplug: () =>
      feed.error(new DOMException("The device has been lost.", "NetworkError")),
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("webSerialLink", () => {
  it("opens at 115200, passes bytes both ways", async () => {
    const f = fakePort();
    const link = createWebSerialLink(f.port);
    const got: string[] = [];
    link.onData((b) => got.push(new TextDecoder().decode(b)));
    await link.open();
    f.send("I (1) boot\n");
    await tick();
    await link.write(new TextEncoder().encode('{"id":1}\n'));
    expect(f.calls[0]).toBe("open 115200");
    expect(got).toEqual(["I (1) boot\n"]);
    expect(f.written).toEqual(['{"id":1}\n']);
  });

  it("reports a pulled cable as an unexpected close", async () => {
    const f = fakePort();
    const link = createWebSerialLink(f.port, 9600);
    const closes: (Error | undefined)[] = [];
    link.onClose((e) => closes.push(e));
    await link.open();
    f.unplug();
    await tick();
    await tick();
    expect(closes).toHaveLength(1);
    expect(closes[0]?.message).toMatch(/disconnected/);
    await expect(link.write(new Uint8Array([1]))).rejects.toThrow();
  });

  it("closes cleanly on request, once, and releases the port", async () => {
    const f = fakePort();
    const link = createWebSerialLink(f.port);
    const closes: (Error | undefined)[] = [];
    link.onClose((e) => closes.push(e));
    await link.open();
    await link.close();
    await link.close();
    expect(closes).toEqual([undefined]);
    expect(f.calls).toEqual(["open 115200", "close"]);
  });
});
