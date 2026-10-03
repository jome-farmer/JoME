import { describe, expect, it } from "vitest";
import { identityLabel, toE164, toEmail, toShareIdentity } from "./identity";

describe("toShareIdentity", () => {
  it("names an email the way the server does: lower case", () => {
    expect(toShareIdentity("  Ali@Example.COM ")).toBe("email:ali@example.com");
  });

  it("names an Iranian mobile in international form, however it is typed", () => {
    for (const typed of [
      "0912 345 6789",
      "912-345-6789",
      "+98 912 345 6789",
      "00989123456789",
    ])
      expect(toShareIdentity(typed)).toBe("phone:+989123456789");
  });

  it("refuses anything else", () => {
    for (const typed of [
      "",
      "ali",
      "ali@",
      "0212 345 6789",
      "12345",
      "a b@c.d",
    ])
      expect(toShareIdentity(typed)).toBeNull();
  });
});

describe("identityLabel", () => {
  it("drops the kind and writes a phone number the way people read it", () => {
    expect(identityLabel("email:ali@example.com")).toBe("ali@example.com");
    expect(identityLabel("phone:+989123456789")).toBe(
      identityLabel("phone:+989123456789"),
    );
    expect(identityLabel("phone:+989123456789")).not.toContain("phone:");
    expect(identityLabel(null)).toBe("Someone");
  });

  it("keeps toE164 and toEmail available to sign-in", () => {
    expect(toE164("09123456789")).toBe("+989123456789");
    expect(toEmail("A@b.co")).toBe("a@b.co");
  });
});
