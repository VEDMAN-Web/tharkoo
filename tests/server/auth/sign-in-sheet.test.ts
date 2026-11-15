import { describe, expect, it } from "vitest";
import { RESEND_SECONDS, digitsOnly, normalizeIdentifier } from "@/components/auth/SignInSheet";
import { ACCOUNT_PATH, landingFor } from "@/components/auth/landing";

describe("sign-in sheet helpers", () => {
  it("keeps only digits in the code box and stops at six", () => {
    expect(digitsOnly("12 34-56789", 6)).toBe("123456");
    expect(digitsOnly("ab", 6)).toBe("");
  });

  it("trims and lower-cases email but leaves a phone number as typed", () => {
    expect(normalizeIdentifier("email", "  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeIdentifier("phone", " +91 98765 43210 ")).toBe("+91 98765 43210");
  });

  it("resends after thirty seconds", () => {
    expect(RESEND_SECONDS).toBe(30);
  });
});

describe("landing after a code sign-in", () => {
  it("sends everyone to the account page", () => {
    expect(ACCOUNT_PATH).toBe("/u/account/");
    expect(landingFor({ roles: ["user"], next: null })).toBe("/u/account/");
    expect(landingFor({ roles: undefined, next: null })).toBe("/u/account/");
  });

  it("sends staff to the admin area, unless a return address is set", () => {
    expect(landingFor({ roles: ["superadmin"], next: null })).toBe("/admin/");
    expect(landingFor({ roles: ["superadmin"], next: "/admin/ads/" })).toBe("/admin/ads/");
  });

  it("returns to a same-origin address and ignores anything else", () => {
    expect(landingFor({ roles: ["user"], next: "/u/post-insert/" })).toBe("/u/post-insert/");
    expect(landingFor({ roles: ["user"], next: "https://evil.example/x" })).toBe("/u/account/");
    expect(landingFor({ roles: ["user"], next: "//evil.example" })).toBe("/u/account/");
  });
});
