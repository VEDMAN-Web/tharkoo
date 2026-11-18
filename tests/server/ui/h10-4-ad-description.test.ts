import { describe, expect, it } from "vitest";
import { AD_DESCRIPTION_MAX, AD_DESCRIPTION_MIN, adMetaDescription } from "@/lib/seo/ad-description";

const base = { category: "Spa", city: "Warangal", site: "Tharkoo" };

describe("H10.4 ad page meta description", () => {
  it("builds the sentence from the title, category and city, and adds a true closing line while it is under 120 characters", () => {
    expect(adMetaDescription({ ...base, title: "Morning walk meetup in Warangal" })).toBe("Morning walk meetup in Warangal: Spa ads in Warangal on Tharkoo. See photos, chat and verify before you meet. More Spa ads in Warangal.");
  });

  it("is 120 to 160 characters for short, normal and very long titles, with and without a city", () => {
    const titles = ["Flat", "Cat carrier", "Maths tutoring in Puducherry", "A very long title that goes on and on about a flat near the station with two balconies and a view of the lake and more words to fill space", "x".repeat(300)];
    for (const title of titles) {
      for (const city of ["Warangal", "Navi Mumbai", ""]) {
        for (const category of ["Spa", "Personal Ads", ""]) {
          const text = adMetaDescription({ title, category, city, site: "Tharkoo" });
          expect(text.length, `${title.slice(0, 20)} | ${category} | ${city}`).toBeGreaterThanOrEqual(AD_DESCRIPTION_MIN);
          expect(text.length, `${title.slice(0, 20)} | ${category} | ${city}`).toBeLessThanOrEqual(AD_DESCRIPTION_MAX);
        }
      }
    }
  });

  it("keeps the facts: the title or its start, the category and the city, and invents nothing else", () => {
    const text = adMetaDescription({ ...base, title: "A very long title that goes on and on about a flat near the station with two balconies and a view of the lake and more words" });
    expect(text).toContain("Spa ads in Warangal on Tharkoo.");
    expect(text.startsWith("A very long title")).toBe(true);
    expect(text).toContain("…:");
    expect(text).not.toMatch(/free|cheap|best|verified by/i);
  });
});
