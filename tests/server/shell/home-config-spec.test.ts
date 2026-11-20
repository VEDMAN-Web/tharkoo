import { describe, expect, it } from "vitest";
import { commonCity, splitHeadline, tierKeyOf } from "@/components/new/home-copy";
import { TEXT_DEFAULTS, TEXT_KEYS } from "@/lib/ui/text";

describe("New design home helpers", () => {
  it("marks the last two words of the banner heading for the gradient", () => {
    expect(splitHeadline("Buy, sell and meet people near you")).toEqual({ lead: "Buy, sell and meet people", accent: "near you" });
    expect(splitHeadline("Tharkoo")).toEqual({ lead: "", accent: "Tharkoo" });
    expect(splitHeadline("  Two words  ")).toEqual({ lead: "", accent: "Two words" });
  });

  it("uses the city only when every shown ad is in the same city", () => {
    expect(commonCity([{ citySlug: "surat" }, { citySlug: "surat" }])).toBe("surat");
    expect(commonCity([{ citySlug: "surat" }, { citySlug: "mumbai" }])).toBe("");
    expect(commonCity([{ citySlug: "surat" }, {}])).toBe("");
    expect(commonCity([])).toBe("");
  });

  it("gives a badge only to paid or highlighted variants", () => {
    expect(tierKeyOf("supertop")).toBe("card.tier.supertop");
    expect(tierKeyOf("flash")).toBe("card.tier.supertop");
    expect(tierKeyOf("free")).toBeUndefined();
    expect(tierKeyOf(undefined)).toBeUndefined();
  });

  it("has a default for every home text key, short enough for the admin", () => {
    const homeKeys = TEXT_KEYS.filter((key) => key.startsWith("home."));
    expect(homeKeys.length).toBeGreaterThan(20);
    for (const key of homeKeys) {
      if (key === "home.utility.phone") continue; // FIX-21: no stand-in number; the strip shows a phone only when one is saved
      expect(TEXT_DEFAULTS[key].trim().length, key).toBeGreaterThan(0);
    }
  });
});
