import { describe, expect, it } from "vitest";
import { fallbackLanding } from "@/lib/seo/landing";

describe("district heading", () => {
  it("names the district and the city", () => {
    expect(fallbackLanding({ category: "Dating", city: "Surat", district: "Choryasi", count: 3 }).h1).toBe("Dating in Choryasi, Surat");
  });

  it("names only the city on a city page", () => {
    expect(fallbackLanding({ category: "Dating", city: "Surat", count: 3 }).h1).toBe("Dating in Surat");
  });
});
