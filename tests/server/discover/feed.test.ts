import { describe, expect, it } from "vitest";
import {
  arrangeFeed,
  buildFeedPage,
  clampPage,
  DISCOVER_MAX_PAGE,
  hashSeed,
  matchesFilters,
  pageOf,
  seededShuffle,
  type FeedCard,
} from "@/server/discover/feed";

function card(id: string, overrides: Partial<FeedCard> = {}): FeedCard {
  return {
    id,
    publicId: `ad-${id}`,
    slug: `ad-${id}`,
    title: `Ad ${id}`,
    description: "",
    place: "Surat",
    categorySlug: "flats",
    citySlug: "surat",
    price: 1000,
    photos: [],
    variant: "free",
    verified: false,
    videoVerifiedUntil: null,
    ...overrides,
  };
}

const POOL = Array.from({ length: 40 }, (_, index) => card(`l${index}`, { citySlug: index % 3 === 0 ? "pune" : "surat" }));

describe("discover feed ordering", () => {
  it("gives the same order for the same seed and a different order for another seed", () => {
    const first = seededShuffle(POOL, "visit-a").map((item) => item.id);
    const again = seededShuffle(POOL, "visit-a").map((item) => item.id);
    const other = seededShuffle(POOL, "visit-b").map((item) => item.id);
    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it("returns a permutation and leaves the input untouched", () => {
    const before = POOL.map((item) => item.id);
    const shuffled = seededShuffle(POOL, "seed-1");
    expect(shuffled.map((item) => item.id).sort()).toEqual([...before].sort());
    expect(POOL.map((item) => item.id)).toEqual(before);
  });

  it("hashes a seed to an unsigned 32 bit number", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).toBeGreaterThanOrEqual(0);
    expect(hashSeed("abc")).toBeLessThan(2 ** 32);
  });

  it("puts ads from the user's city first and keeps every ad", () => {
    const arranged = arrangeFeed(POOL, "seed-x", "pune");
    const firstOther = arranged.findIndex((item) => item.citySlug !== "pune");
    expect(arranged.slice(0, firstOther).every((item) => item.citySlug === "pune")).toBe(true);
    expect(arranged).toHaveLength(POOL.length);
  });

  it("does not repeat or skip ads across pages of one visit", () => {
    const all = arrangeFeed(POOL, "visit-stable");
    const seen: string[] = [];
    for (let page = 1; page <= 4; page += 1) {
      seen.push(...pageOf(all, page, 12).items.map((item) => item.id));
    }
    expect(seen).toEqual(all.map((item) => item.id));
    expect(new Set(seen).size).toBe(POOL.length);
  });
});

describe("discover filters", () => {
  it("applies the price range and drops ads without a price when a range is set", () => {
    const priced = card("p", { price: 4000 });
    const free = card("f", { price: null });
    expect(matchesFilters(priced, { minPrice: 5000 })).toBe(false);
    expect(matchesFilters(priced, { maxPrice: 5000 })).toBe(true);
    expect(matchesFilters(free, { maxPrice: 5000 })).toBe(false);
    expect(matchesFilters(free, {})).toBe(true);
  });

  it("keeps only ads with a video verified in the future when withVideo is set", () => {
    const now = new Date("2026-11-15T00:00:00Z");
    const live = card("v1", { videoVerifiedUntil: "2027-01-01T00:00:00Z" });
    const expired = card("v2", { videoVerifiedUntil: "2026-01-01T00:00:00Z" });
    expect(matchesFilters(live, { withVideo: true }, now)).toBe(true);
    expect(matchesFilters(expired, { withVideo: true }, now)).toBe(false);
    expect(matchesFilters(expired, { withVideo: false }, now)).toBe(true);
  });

  it("never returns the viewer's own ads", () => {
    const pool = [card("mine"), card("theirs"), card("other")];
    const page = buildFeedPage({ pool, ownIds: new Set(["mine"]), filters: {}, seed: "s", page: 1 });
    expect(page.items.map((item) => item.id).sort()).toEqual(["other", "theirs"]);
  });
});

describe("discover paging", () => {
  it("clamps the page number to the allowed range", () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(Number.NaN)).toBe(1);
    expect(clampPage(3.7)).toBe(3);
    expect(clampPage(10_000)).toBe(DISCOVER_MAX_PAGE);
  });

  it("reports hasMore only while more ads follow", () => {
    const pool = Array.from({ length: 25 }, (_, index) => card(`n${index}`));
    const first = buildFeedPage({ pool, ownIds: new Set(), filters: {}, seed: "p", page: 1 });
    const last = buildFeedPage({ pool, ownIds: new Set(), filters: {}, seed: "p", page: 3 });
    expect(first.items).toHaveLength(12);
    expect(first.hasMore).toBe(true);
    expect(last.items).toHaveLength(1);
    expect(last.hasMore).toBe(false);
  });
});
