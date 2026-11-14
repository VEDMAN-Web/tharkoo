import { describe, expect, it } from "vitest";
import { RESEND_SECONDS, digitsOnly, normalizeIdentifier } from "@/components/auth/SignInSheet";
import { DEFAULT_LANDING, landingFor } from "@/components/auth/landing";

const paths = DEFAULT_LANDING;

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

describe("landing after a code sign-in (H7.2b)", () => {
  const base = { roles: ["user"], hasSellerProfile: false, role: "user" as const, next: null, paths };

  it("sends staff to the admin area, unless a return address is set", () => {
    expect(landingFor({ ...base, roles: ["superadmin"] })).toBe("/admin/");
    expect(landingFor({ ...base, roles: ["superadmin"], next: "/admin/ads/" })).toBe("/admin/ads/");
  });

  it("sends a user to the user panel and a returning seller to the seller panel", () => {
    expect(landingFor(base)).toBe(paths.user);
    expect(landingFor({ ...base, hasSellerProfile: true })).toBe(paths.seller);
  });

  it("sends a new seller through the seller profile once, then on to the ad form", () => {
    expect(landingFor({ ...base, role: "seller" })).toBe(`${paths.sellerProfile}?next=${encodeURIComponent(paths.postAd)}`);
    expect(landingFor({ ...base, role: "seller", next: "/u/post-insert?draft=abc" })).toBe(
      `${paths.sellerProfile}?next=${encodeURIComponent("/u/post-insert?draft=abc")}`,
    );
  });

  it("does not repeat the profile step for a seller who already has one", () => {
    expect(landingFor({ ...base, role: "seller", hasSellerProfile: true })).toBe(paths.seller);
  });

  it("ignores a return address that is not same-origin", () => {
    expect(landingFor({ ...base, next: "https://evil.example/x" })).toBe(paths.user);
    expect(landingFor({ ...base, next: "//evil.example" })).toBe(paths.user);
  });
});
