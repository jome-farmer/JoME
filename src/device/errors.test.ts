import { expect, it } from "vitest";
import { DeviceError } from "./client";
import { errorText, offlineText } from "./errors";

it("shows the app's words for a code, not the board's English message", () => {
  expect(errorText(new DeviceError("ZONE_BUSY", "Zone 2 is running"))).toBe(
    "Another zone is watering. Stop it first, or wait until it finishes.",
  );
  expect(errorText(new DeviceError("CLOCK_NOT_SET", "clock"))).toMatch(/time/);
});

it("stays generic for codes it doesn't know yet, and passes other errors through", () => {
  expect(errorText(new DeviceError("NEW_CODE", "x"))).toBe(
    "Something went wrong (NEW_CODE).",
  );
  expect(errorText({ code: "TIMEOUT" })).toMatch(/didn't answer/);
  expect(errorText(new Error("plain"))).toBe("plain");
});

it("keeps the board's name when it's offline", () => {
  const refused = new DeviceError("DEVICE_OFFLINE", offlineText("Backyard"));
  expect(errorText(refused)).toBe(
    "Changes need Backyard online. It reconnects on its own when its Wi‑Fi is back.",
  );
  expect(errorText(new DeviceError("DEVICE_OFFLINE", ""))).toBe(
    offlineText("JoME"),
  );
});
