import { describe, expect, it } from "vitest";
import {
  MAX_PICKS_PER_FILTER,
  activeFilterKeys,
  indexableListingKind,
  isIndexableListing,
  listingRobots,
  parseFieldFilters,
} from "@/server/search/filter-seo";

describe("filter parameters", () => {
  it("counts a parameter with a value as a filter, and ignores tracking and empty ones", () => {
    expect(activeFilterKeys({ q: "gym", utm_source: "news", gclid: "abc", city: "", "f.hair": ["Blonde"] })).toEqual(["f.hair", "q"]);
    expect(activeFilterKeys({ state: ["  "] })).toEqual([]);
  });

  it("makes a filter page noindex with follow, and a clean page indexable", () => {
    expect(listingRobots({ q: "gym" })).toEqual({ index: false, follow: true });
    expect(listingRobots({ utm_medium: "email" })).toEqual({ index: true, follow: true });
    expect(listingRobots({})).toEqual({ index: true, follow: true });
  });
});

describe("indexable listing pages", () => {
  it("allows exactly category, category plus city, and category plus city plus area", () => {
    expect(indexableListingKind({})).toBe("category");
    expect(indexableListingKind({ city: "surat" })).toBe("category-city");
    expect(indexableListingKind({ city: "surat", area: "adajan" })).toBe("category-city-area");
  });

  it("refuses an area without a city and any page that has a filter", () => {
    expect(indexableListingKind({ area: "adajan" })).toBeNull();
    expect(isIndexableListing({ city: "surat" }, {})).toBe(true);
    expect(isIndexableListing({ city: "surat" }, { q: "gym" })).toBe(false);
  });
});

describe("field filters", () => {
  it("keeps valid field keys, drops other keys, and caps the picks per field", () => {
    const many = Array.from({ length: MAX_PICKS_PER_FILTER + 5 }, (_, index) => `Option ${index}`);
    const parsed = parseFieldFilters({ "f.hair": many, "f.Bad-Key": "x", "f.age": "", q: "gym", "f.looking": ["Dating", "  "] });
    expect(parsed["f.hair"]).toBeUndefined();
    expect(parsed.hair).toHaveLength(MAX_PICKS_PER_FILTER);
    expect(parsed).not.toHaveProperty("Bad-Key");
    expect(parsed.looking).toEqual(["Dating"]);
    expect(parsed).not.toHaveProperty("age");
  });
});
