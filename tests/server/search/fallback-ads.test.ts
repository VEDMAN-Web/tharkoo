import { describe, expect, it } from "vitest";
import { FALLBACK_OWN_MINIMUM, FALLBACK_TOTAL, composeFallback, fallbackBudget, showFallback } from "@/lib/fallback-ads";

type Ad = { slug: string; stateSlug: string };

function ads(prefix: string, count: number, stateSlug = "gujarat"): Ad[] {
  return Array.from({ length: count }, (_, index) => ({ slug: `${prefix}-${index}`, stateSlug }));
}

function run(input: { own: number; sources: Ad[][]; stateSlug?: string; ownSlugs?: string[] }) {
  const ownSlugs = input.ownSlugs ?? ads("own", input.own).map((ad) => ad.slug);
  const keys = ["nearby", "category", "latest"] as const;
  return composeFallback<Ad>({
    budget: fallbackBudget(input.own),
    ownSlugs,
    stateSlug: input.stateSlug,
    sources: input.sources.map((items, index) => ({ key: keys[index % 3], title: `section ${index}`, items })),
  });
}

const total = (sections: { items: Ad[] }[]) => sections.reduce((sum, section) => sum + section.items.length, 0);

describe("fallbackBudget", () => {
  it("gives 15 cards when the page has no own results, 12 at 3, and none at 8 or more", () => {
    expect(fallbackBudget(0)).toBe(FALLBACK_TOTAL);
    expect(fallbackBudget(3)).toBe(12);
    expect(fallbackBudget(FALLBACK_OWN_MINIMUM - 1)).toBe(FALLBACK_TOTAL - (FALLBACK_OWN_MINIMUM - 1));
    expect(fallbackBudget(FALLBACK_OWN_MINIMUM)).toBe(0);
    expect(fallbackBudget(10)).toBe(0);
  });
});

describe("composeFallback", () => {
  it("fills up to 15 cards when the page has no own results", () => {
    const sections = run({ own: 0, sources: [ads("a", 30), ads("b", 30), ads("c", 30)] });
    expect(total(sections)).toBe(FALLBACK_TOTAL);
    expect(sections.map((section) => section.items.length)).toEqual([15]);
  });

  it("keeps own results and fills the rest to 15 when the page has 3 own results", () => {
    const sections = run({ own: 3, sources: [ads("a", 30), ads("b", 30)] });
    expect(total(sections)).toBe(12);
    expect(total(sections) + 3).toBe(FALLBACK_TOTAL);
  });

  it("adds no fallback when the page has 10 own results", () => {
    expect(run({ own: 10, sources: [ads("a", 30)] })).toEqual([]);
  });

  it("never repeats an ad: own results, or an ad that is in two sources", () => {
    const shared = ads("shared", 4);
    const sections = run({ own: 2, ownSlugs: ["shared-0", "own-x"], sources: [shared, [...shared, ...ads("b", 2)]] });
    const shown = sections.flatMap((section) => section.items.map((ad) => ad.slug));
    expect(new Set(shown).size).toBe(shown.length);
    expect(shown).not.toContain("shared-0");
    expect(shown).not.toContain("own-x");
    expect(shown).toEqual(["shared-1", "shared-2", "shared-3", "b-0", "b-1"]);
  });

  it("puts ads from the same state first, keeping their order", () => {
    const other = ads("far", 3, "maharashtra");
    const near = ads("near", 3, "gujarat");
    const sections = run({ own: 0, stateSlug: "gujarat", sources: [[...other, ...near]] });
    expect(sections[0].items.map((ad) => ad.slug)).toEqual(["near-0", "near-1", "near-2", "far-0", "far-1", "far-2"]);
  });

  it("skips a section with no ads left and keeps the section order", () => {
    const sections = run({ own: 0, sources: [[], ads("b", 2), ads("c", 2)] });
    expect(sections.map((section) => section.key)).toEqual(["category", "latest"]);
    expect(total(sections)).toBe(4);
  });

  it("returns nothing when there is no budget left", () => {
    expect(composeFallback({ budget: 0, ownSlugs: [], sources: [{ key: "latest", title: "x", items: ads("a", 3) }] })).toEqual([]);
  });
});

describe("showFallback", () => {
  const items = (count: number) => Array.from({ length: count }, (_, index) => index);

  it("shows fallback ads only on the last page, and only when its own ads are few", () => {
    expect(showFallback({ page: 3, pages: 3, items: items(2) })).toBe(true);
    expect(showFallback({ page: 2, pages: 3, items: items(2) })).toBe(false);
    expect(showFallback({ page: 3, pages: 3, items: items(FALLBACK_OWN_MINIMUM) })).toBe(false);
    expect(showFallback({ page: 1, pages: 1, items: [] })).toBe(true);
  });

  it("caps a page at 15 cards", () => {
    expect(FALLBACK_TOTAL).toBe(15);
  });
});
