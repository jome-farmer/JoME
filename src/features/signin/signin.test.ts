import { describe, expect, it } from "vitest";
import { codeDigits, toE164, toEmail } from "./signin";

describe("toE164", () => {
  it.each([
    "09123456789",
    "9123456789",
    "0912 345 6789",
    "+98 912 345 6789",
    "+989123456789",
    "00989123456789",
    "989123456789",
    "(0912) 345-6789",
    "۰۹۱۲۳۴۵۶۷۸۹",
    "٠٩١٢٣٤٥٦٧٨٩",
  ])("reads %s as an Iranian mobile", (input) => {
    expect(toE164(input)).toBe("+989123456789");
  });

  it.each([
    "",
    "0912345678", // one digit short
    "091234567890", // one too many
    "02112345678", // a Tehran landline
    "+19123456789", // not Iran
    "0912abc6789",
  ])("rejects %j", (input) => {
    expect(toE164(input)).toBeNull();
  });
});

describe("toEmail", () => {
  it("trims and lower-cases", () => {
    expect(toEmail("  Grower@Example.COM ")).toBe("grower@example.com");
  });
  it.each(["", "grower", "grower@", "@example.com", "a b@example.com", "a@b"])(
    "rejects %j",
    (input) => {
      expect(toEmail(input)).toBeNull();
    },
  );
});

describe("codeDigits", () => {
  it("keeps up to 6 digits from typing or pasting", () => {
    expect(codeDigits("483 920")).toBe("483920");
    expect(codeDigits("4839201")).toBe("483920");
    expect(codeDigits("۴۸۳۹۲۰")).toBe("483920");
    expect(codeDigits("12a")).toBe("12");
  });
});
