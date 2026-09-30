import { describe, expect, it } from "vitest";
import {
  createAndroidUsbLink,
  fromBase64,
  toBase64,
  type UsbSerialPlugin,
} from "./androidUsbLink";

/** Stands in for the Java plugin: records calls and lets the test fire its events. */
function fakePlugin(opts: { openFails?: boolean } = {}) {
  const listeners: Record<string, ((e: never) => void)[]> = {};
  const calls: string[] = [];
  const plugin = {
    list: async () => ({ devices: [] }),
    open: async (o: { deviceId: number; baudRate: number }) => {
      calls.push(`open ${o.deviceId}@${o.baudRate}`);
      if (opts.openFails)
        throw new Error("Permission to use the USB adapter was denied");
    },
    write: async (o: { data: string }) => void calls.push(`write ${o.data}`),
    close: async () => void calls.push("close"),
    addListener: async (event: string, cb: (e: never) => void) => {
      (listeners[event] ??= []).push(cb);
      return {
        remove: async () => {
          listeners[event] = listeners[event].filter((x) => x !== cb);
        },
      };
    },
  } as unknown as UsbSerialPlugin;
  const fire = (event: string, e: unknown) =>
    (listeners[event] ?? []).forEach((cb) => cb(e as never));
  const count = () => Object.values(listeners).flat().length;
  return { plugin, calls, fire, count };
}

describe("base64 bridge encoding", () => {
  it("round-trips arbitrary bytes, including non-ASCII", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 200, 255, 10]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
    expect(toBase64(new TextEncoder().encode("hi\n"))).toBe("aGkK");
  });
});

describe("androidUsbLink", () => {
  it("opens with the baud rate and passes bytes both ways", async () => {
    const f = fakePlugin();
    const link = createAndroidUsbLink(1003, 9600, f.plugin);
    const got: string[] = [];
    link.onData((b) => got.push(new TextDecoder().decode(b)));
    await link.open();
    f.fire("data", {
      data: toBase64(new TextEncoder().encode("I (1) boot\n")),
    });
    await link.write(new TextEncoder().encode("hi\n"));
    expect(got).toEqual(["I (1) boot\n"]);
    expect(f.calls).toEqual(["open 1003@9600", "write aGkK"]);
    expect(link.peerId).toBe("1003");
  });

  it("reports an unplugged cable as an unexpected close and stops listening", async () => {
    const f = fakePlugin();
    const link = createAndroidUsbLink(7, undefined, f.plugin);
    const closes: (Error | undefined)[] = [];
    link.onClose((e) => closes.push(e));
    await link.open();
    f.fire("closed", { error: "The USB cable was disconnected" });
    await Promise.resolve();
    expect(closes.map((e) => e?.message)).toEqual([
      "The USB cable was disconnected",
    ]);
    expect(f.count()).toBe(0);
    await expect(link.write(new Uint8Array([1]))).rejects.toThrow();
  });

  it("cleans up listeners when opening fails, e.g. permission denied", async () => {
    const f = fakePlugin({ openFails: true });
    const link = createAndroidUsbLink(7, undefined, f.plugin);
    await expect(link.open()).rejects.toThrow(/denied/);
    expect(f.count()).toBe(0);
  });

  it("closes on request once, without an error", async () => {
    const f = fakePlugin();
    const link = createAndroidUsbLink(7, undefined, f.plugin);
    const closes: (Error | undefined)[] = [];
    link.onClose((e) => closes.push(e));
    await link.open();
    await link.close();
    await link.close();
    expect(closes).toEqual([undefined]);
    expect(f.calls.filter((c) => c === "close")).toHaveLength(1);
  });
});
