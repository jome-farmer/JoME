import { describe, expect, it } from "vitest";
import { classify, encodeLine, LineDecoder, MAX_LINE } from "./lineCodec";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("LineDecoder", () => {
  it("splits lines and keeps a partial line for the next chunk", () => {
    const d = new LineDecoder();
    expect(d.push(bytes('I (12) boot\n{"evt":"st'))).toEqual([
      { kind: "log", text: "I (12) boot" },
    ]);
    expect(d.push(bytes('atus","data":{}}\n'))).toEqual([
      {
        kind: "msg",
        text: '{"evt":"status","data":{}}',
        msg: { evt: "status", data: {} },
      },
    ]);
  });

  it("strips CR and skips empty lines", () => {
    const d = new LineDecoder();
    expect(d.push(bytes("a\r\n\r\nb\n")).map((l) => l.text)).toEqual([
      "a",
      "b",
    ]);
  });

  it("joins a UTF-8 character split across chunks", () => {
    const all = bytes("zone: باغچه\n");
    const cut = all.length - 2; // between the two bytes of the last Persian letter
    const d = new LineDecoder();
    expect(d.push(all.slice(0, cut))).toEqual([]);
    expect(d.push(all.slice(cut))).toEqual([
      { kind: "log", text: "zone: باغچه" },
    ]);
  });

  it("flushes an endless line as a log line instead of growing forever", () => {
    const d = new LineDecoder();
    const out = d.push(bytes("x".repeat(MAX_LINE + 1)));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("log");
  });
});

describe("classify", () => {
  it("treats broken or non-object JSON as a log line", () => {
    expect(classify("{not json").kind).toBe("log");
    expect(classify("[1,2]").kind).toBe("log");
    expect(classify("{}").kind).toBe("msg");
  });
});

it("encodeLine appends a newline", () => {
  expect(new TextDecoder().decode(encodeLine('{"id":1}'))).toBe('{"id":1}\n');
});
