import { describe, expect, it } from "vitest";
import { RESEND_SECONDS, destinationFor, digitsOnly, normalizeIdentifier } from "@/components/auth/SignInSheet";

describe("sign-in sheet helpers", () => {
  it("keeps only digits in the code box and stops at six", () => {
    expect(digitsOnly("12 34-56789", 6)).toBe("123456");
    expect(digitsOnly("ab", 6)).toBe("");
  });

  it("trims and lower-cases email but leaves a phone number as typed", () => {
    expect(normalizeIdentifier("email", "  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeIdentifier("phone", " +91 98765 43210 ")).toBe("+91 98765 43210");
  });

  it("sends staff to the admin area and everyone else to the account, unless a return address is set", () => {
    expect(destinationFor(["user"], null)).toBe("/u/account/dashboard/");
    expect(destinationFor(["superadmin"], null)).toBe("/admin/");
    expect(destinationFor(["user"], "/u/account/ads/")).toBe("/u/account/ads/");
  });

  it("resends after thirty seconds", () => {
    expect(RESEND_SECONDS).toBe(30);
  });
});
