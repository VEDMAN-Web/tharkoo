import { describe, expect, it } from "vitest";
import { makeT } from "@/lib/ui/text";
import { categoryAds, searchChips, searchHeading, searchHref, sortFrom, type SearchState } from "@/components/new/search-header";

const t = makeT();
const labels = { category: "Category", state: "State", city: "City", area: "Area", verified: "Verified", photos: "With photos", video: "With video", online: "Online now" };
const none = { verified: false, photos: false, video: false, online: false };
const empty = { toggles: none, picks: {} } satisfies SearchState;

describe("searchHeading", () => {
  it("is built from the filters", () => {
    expect(searchHeading(empty, t)).toBe("All ads in India");
    expect(searchHeading({ city: { slug: "surat", name: "Surat" } }, t)).toBe("Ads in Surat");
    expect(searchHeading({ category: { slug: "dating", name: "Dating" }, state: { slug: "gujarat", name: "Gujarat" } }, t)).toBe("Dating ads in Gujarat");
    expect(searchHeading({ category: { slug: "dating", name: "Dating" } }, t)).toBe("Dating ads in India");
    expect(searchHeading({ category: { slug: "personal-ads", name: "Personal ads" }, city: { slug: "surat", name: "Surat" }, area: { slug: "choryasi", name: "Choryasi" } }, t)).toBe("Personal ads in Choryasi, Surat");
    expect(searchHeading({ q: "yoga", city: { slug: "surat", name: "Surat" } }, t)).toBe("Results for \u201cyoga\u201d");
  });

  it("does not repeat the word ads", () => {
    expect(categoryAds("Personal ads")).toBe("Personal ads");
    expect(categoryAds("Dating")).toBe("Dating ads");
  });
});

describe("searchChips", () => {
  const params = { q: "yoga", category: "dating", city: "surat", area: "choryasi", online: "1", "f.age": ["20-25"], sort: "online", page: "3" };
  const state: SearchState = {
    q: "yoga",
    category: { slug: "dating", name: "Dating" },
    city: { slug: "surat", name: "Surat" },
    area: { slug: "choryasi", name: "Choryasi" },
    toggles: { ...none, online: true },
    picks: { age: ["20-25"] },
    fields: [{ key: "age", label: "Age" }],
  };
  const chips = searchChips("/search/", params, state, labels, t);

  it("has one chip per active filter, with plain labels", () => {
    expect(chips.map((chip) => chip.label)).toEqual(["Keyword: yoga", "Category: Dating", "City: Surat", "Area: Choryasi", "Online now", "Age: 20-25"]);
  });

  it("removes only its own filter and drops the page", () => {
    const byKey = Object.fromEntries(chips.map((chip) => [chip.key, chip.href]));
    expect(byKey.q).toBe("/search/?category=dating&city=surat&area=choryasi&online=1&f.age=20-25&sort=online");
    expect(byKey.online).toBe("/search/?q=yoga&category=dating&city=surat&area=choryasi&f.age=20-25&sort=online");
    expect(byKey["f.age"]).toBe("/search/?q=yoga&category=dating&city=surat&area=choryasi&online=1&sort=online");
  });

  it("removing the category also removes the category's own filters, and the city removes the area", () => {
    const byKey = Object.fromEntries(chips.map((chip) => [chip.key, chip.href]));
    expect(byKey.category).toBe("/search/?q=yoga&city=surat&area=choryasi&online=1&sort=online");
    expect(byKey.city).toBe("/search/?q=yoga&category=dating&online=1&f.age=20-25&sort=online");
  });
});

describe("searchHref and sortFrom", () => {
  it("builds clean addresses", () => {
    expect(searchHref("/search/", {})).toBe("/search/");
    expect(searchHref("/search/", { page: "2", q: "bike" })).toBe("/search/?q=bike");
  });

  it("accepts only the known sorts", () => {
    expect(sortFrom("online")).toBe("online");
    expect(sortFrom("price")).toBe("");
    expect(sortFrom(undefined)).toBe("");
  });
});
