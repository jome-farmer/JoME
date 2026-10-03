import { describe, expect, it } from "vitest";
import { backAction } from "./backButton";

const at = (pathname: string, historyIndex = 0) => ({
  cancelShown: false,
  sheetOpen: false,
  historyIndex,
  pathname,
});

describe("Android back", () => {
  it("cancels a confirm before anything else", () => {
    expect(
      backAction({ ...at("/zones", 2), cancelShown: true, sheetOpen: true }),
    ).toBe("cancel");
  });
  it("closes an open sheet", () => {
    expect(backAction({ ...at("/zones", 2), sheetOpen: true })).toBe("close");
  });
  it("goes back a screen when there is one", () => {
    expect(backAction(at("/schedule/3", 2))).toBe("back");
    expect(backAction(at("/setup/claim", 1))).toBe("back");
    expect(backAction(at("/device", 1))).toBe("back");
  });
  it("goes Home from another tab, not back through the tabs", () => {
    expect(backAction(at("/more"))).toBe("home");
    expect(backAction(at("/map", 2))).toBe("home");
    expect(backAction(at("/schedule", 3))).toBe("home");
  });
  it("leaves from Home, or a first screen with nothing behind it", () => {
    expect(backAction(at("/", 4))).toBe("leave");
    expect(backAction(at("/welcome"))).toBe("leave");
  });
});
