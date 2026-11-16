import { describe, expect, it } from "vitest";
import { pageBase, pageHref, pagerItems, showingRange } from "@/components/new/listing-pager";

describe("pagerItems", () => {
  it("shows first, last, current and one on each side, with a gap between", () => {
    expect(pagerItems(5, 14)).toEqual([1, "gap", 4, 5, 6, "gap", 14]);
  });

  it("fills a gap of one page with that page", () => {
    expect(pagerItems(4, 14)).toEqual([1, 2, 3, 4, 5, "gap", 14]);
    expect(pagerItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles the first and last page", () => {
    expect(pagerItems(1, 14)).toEqual([1, 2, "gap", 14]);
    expect(pagerItems(14, 14)).toEqual([1, "gap", 13, 14]);
    expect(pagerItems(1, 2)).toEqual([1, 2]);
  });
});

describe("pageHref", () => {
  it("keeps page 1 clean and puts ?page=N on the rest", () => {
    expect(pageHref("/dating/", 1)).toBe("/dating/");
    expect(pageHref("/dating/", 2)).toBe("/dating/?page=2");
  });

  it("keeps the filters", () => {
    expect(pageHref("/dating/surat/?photos=1&page=3", 1)).toBe("/dating/surat/?photos=1");
    expect(pageHref("/dating/surat/?photos=1", 4)).toBe("/dating/surat/?photos=1&page=4");
  });
});

describe("pageBase", () => {
  it("rebuilds the path with its filters and without the page", () => {
    expect(pageBase("/dating/", { page: "2", verified: "1", "f.age": ["a", "b"] })).toBe("/dating/?verified=1&f.age=a&f.age=b");
    expect(pageBase("/dating/", { page: "2" })).toBe("/dating/");
  });
});

describe("showingRange", () => {
  it("counts the ads on the page", () => {
    expect(showingRange(5, 15, 212)).toEqual({ from: 61, to: 75 });
    expect(showingRange(15, 15, 212)).toEqual({ from: 211, to: 212 });
    expect(showingRange(1, 15, 0)).toEqual({ from: 0, to: 0 });
  });
});
