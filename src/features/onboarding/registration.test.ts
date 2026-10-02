import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceClient, DeviceError } from "../../services/device/client";
import { createMockLink } from "../../services/device/links/mockLink";
import type { ServerState } from "../../services/device/types";
import { RegistrationFailed, registerBoard } from "./registration";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** A demo board (its Wi‑Fi is joined from the start) with its clock set, as setup leaves it. */
async function board({ clock = true } = {}) {
  const link = createMockLink();
  await link.open();
  const client = new DeviceClient(link);
  const run = async (p: Promise<unknown>) => {
    await vi.advanceTimersByTimeAsync(3000);
    return p;
  };
  if (clock)
    await run(
      client.request("time.set", {
        epoch: Math.floor(Date.now() / 1000),
        tz: "UTC",
      }),
    );
  return { client, run };
}

const apiUrl = "https://api.example.com";

describe("registerBoard", () => {
  it("walks registering → online and asks for a fresh token each time", async () => {
    const { client } = await board();
    const states: ServerState["state"][] = [];
    const requestToken = vi.fn().mockResolvedValue({ token: "tok-1" });
    const sent: string[] = [];
    client.onLine((l) => l.dir === "tx" && sent.push(l.text));

    const done = registerBoard(client, {
      requestToken,
      apiUrl,
      onState: (s) => states.push(s.state),
    });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(done).resolves.toBeUndefined();

    expect(states).toEqual([
      "registering",
      "registered",
      "connecting",
      "online",
    ]);
    expect(requestToken).toHaveBeenCalledTimes(1);
    // The token reached the board but never the terminal's traffic log.
    expect(sent.some((t) => t.includes("server.set"))).toBe(true);
    expect(sent.join("\n")).not.toContain("tok-1");
  });

  it("rejects with the reason when the board reports failed", async () => {
    const { client } = await board();
    const done = registerBoard(client, {
      requestToken: async () => ({ token: "bad-token" }),
      apiUrl,
    });
    const caught = done.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(3000);
    const err = await caught;
    expect(err).toBeInstanceOf(RegistrationFailed);
    expect((err as RegistrationFailed).reason).toBe("TOKEN_INVALID");
  });

  const refused = async (options: { clock?: boolean }, url = apiUrl) => {
    const { client } = await board(options);
    const result = registerBoard(client, {
      requestToken: async () => ({ token: "t" }),
      apiUrl: url,
    }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    return result;
  };

  it("passes the board's refusal through when it has no Wi‑Fi", async () => {
    const { client } = await board();
    vi.spyOn(client, "request").mockRejectedValue(
      new DeviceError("NO_NETWORK", "Wi-Fi is not connected"),
    );
    const result = registerBoard(client, {
      requestToken: async () => ({ token: "t" }),
      apiUrl,
    }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toMatchObject({ code: "NO_NETWORK" });
  });

  it("passes the board's refusal through when its clock is not set", async () => {
    expect(await refused({ clock: false })).toMatchObject({
      code: "CLOCK_NOT_SET",
    });
  });

  it("passes the board's refusal through for a url that is not https", async () => {
    expect(await refused({}, "http://insecure")).toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("does not ask the board when the server refuses a token", async () => {
    const { client } = await board();
    const sent: string[] = [];
    client.onLine((l) => l.dir === "tx" && sent.push(l.text));
    await expect(
      registerBoard(client, {
        requestToken: async () => {
          throw new DeviceError("UNAUTHORIZED", "signed out");
        },
        apiUrl,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(sent.some((t) => t.includes("server.set"))).toBe(false);
  });

  it("times out when the board goes quiet", async () => {
    const { client } = await board();
    // A board that answers {} but never reports a state.
    vi.spyOn(client, "request").mockResolvedValue({} as never);
    const done = registerBoard(client, {
      requestToken: async () => ({ token: "t" }),
      apiUrl,
      timeoutMs: 5000,
    }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await done).toMatchObject({ code: "TIMEOUT" });
  });
});
