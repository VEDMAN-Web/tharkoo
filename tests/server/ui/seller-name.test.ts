import { describe, expect, it } from "vitest";
import { publicSellerName } from "@/lib/seller-name";
import { isCityAlias } from "@/lib/seo/district-alias";

describe("publicSellerName", () => {
  it("shows the demo name Seed as Tharkoo member, in any case", () => {
    expect(publicSellerName("Seed")).toBe("Tharkoo member");
    expect(publicSellerName("  seed ")).toBe("Tharkoo member");
  });

  it("keeps a real name and returns an empty string for none", () => {
    expect(publicSellerName("Asha")).toBe("Asha");
    expect(publicSellerName("Seeded Cafe")).toBe("Seeded Cafe");
    expect(publicSellerName(undefined)).toBe("");
    expect(publicSellerName("   ")).toBe("");
  });
});

describe("city alias on the ad page", () => {
  it("treats a district named like its city as the city", () => {
    expect(isCityAlias("Pune", "Pune City")).toBe(true);
    expect(isCityAlias("Pune", "Hadapsar")).toBe(false);
  });
});
