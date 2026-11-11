import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANK_SETTINGS,
  TIER_CODES,
  applyPins,
  compareRank,
  normaliseRankSettings,
  pinScopeOf,
  rankScore,
  type RankSettings,
} from "@/server/ranking";
import defaultOrder from "./default-order.json";
import { fixtureRows, NOW, type FixtureRow } from "./fixture";

function order(rows: FixtureRow[], settings?: RankSettings) {
  return rows
    .map((row) => ({ row, score: rankScore(row.listing, row.promotions, NOW, settings) }))
    .sort((a, b) => compareRank(a.score, b.score, settings) || a.row.slug.localeCompare(b.row.slug))
    .map((entry) => entry.row.slug);
}

describe("default ordering", () => {
  it("matches the order captured from the original code on 30 listings", () => {
    expect(order(fixtureRows())).toEqual(defaultOrder);
  });

  it("is identical when the default settings are passed explicitly", () => {
    expect(order(fixtureRows(), DEFAULT_RANK_SETTINGS)).toEqual(defaultOrder);
  });

  it("is identical for settings that were stored empty or damaged", () => {
    expect(order(fixtureRows(), normaliseRankSettings(undefined))).toEqual(defaultOrder);
    expect(order(fixtureRows(), normaliseRankSettings({ tierOrder: ["nonsense"], verifiedFirst: "yes" }))).toEqual(defaultOrder);
  });
});

describe("custom settings", () => {
  const rows = (): FixtureRow[] => {
    const base = new Date("2026-06-01T00:00:00.000Z");
    const promo = (code: string) => [{ code, status: "active", startsAt: base, endsAt: new Date("2026-07-01T00:00:00.000Z") }];
    return [
      { slug: "a-star", listing: { publishedAt: base }, promotions: promo("star") },
      { slug: "b-top", listing: { publishedAt: base }, promotions: promo("top") },
      { slug: "c-flash", listing: { publishedAt: base }, promotions: promo("flash") },
      { slug: "d-plain", listing: { publishedAt: base }, promotions: [] },
      { slug: "e-verified", listing: { badges: ["verified"], publishedAt: new Date("2026-05-01T00:00:00.000Z") }, promotions: [] },
      { slug: "f-photo", listing: { hasPhoto: true, publishedAt: new Date("2026-05-02T00:00:00.000Z") }, promotions: [] },
    ];
  };

  it("changing the tier order changes the result", () => {
    const tierOrder = ["top", ...TIER_CODES.filter((code) => code !== "top")];
    expect(order(rows(), normaliseRankSettings({ tierOrder }))).toEqual(["b-top", "a-star", "c-flash", "e-verified", "d-plain", "f-photo"]);
    expect(order(rows())).toEqual(["a-star", "c-flash", "b-top", "e-verified", "d-plain", "f-photo"]);
  });

  it("moving free above the paid tiers puts unpaid ads first", () => {
    const tierOrder = ["free", ...TIER_CODES.filter((code) => code !== "free")];
    expect(order(rows(), normaliseRankSettings({ tierOrder })).slice(0, 3)).toEqual(["e-verified", "d-plain", "f-photo"]);
  });

  it("verifiedFirst off lets freshness decide inside a tier", () => {
    const plain = order(rows(), normaliseRankSettings({ verifiedFirst: false }));
    expect(plain.slice(-3)).toEqual(["d-plain", "f-photo", "e-verified"]);
  });

  it("photoFirst on puts ads with photos ahead inside a tier", () => {
    const withPhotos = order(rows(), normaliseRankSettings({ verifiedFirst: false, photoFirst: true }));
    expect(withPhotos.slice(-3)).toEqual(["f-photo", "d-plain", "e-verified"]);
  });

  it("normalise keeps known codes once, in the given order, and appends the rest", () => {
    const next = normaliseRankSettings({ tierOrder: ["Top", "top", "bogus", "star"] });
    expect(next.tierOrder).toEqual(["top", "star", "super-top", "flash", "highlight", "new", "auto-boost", "free"]);
  });
});

describe("pins", () => {
  const ads = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  const idOf = (row: { id: string }) => row.id;
  const hour = 3_600_000;
  const pin = (listingId: string, position: number, startsAt: Date | null = null, endsAt: Date | null = null) => ({ listingId, position, startsAt, endsAt });
  const ids = (rows: { id: string }[]) => rows.map(idOf);

  it("moves a pinned ad to its position", () => {
    expect(ids(applyPins(ads, [pin("d", 1)], idOf, NOW))).toEqual(["d", "a", "b", "c", "e"]);
    expect(ids(applyPins(ads, [pin("a", 3)], idOf, NOW))).toEqual(["b", "c", "a", "d", "e"]);
  });

  it("ignores a pin at position 1 whose dates have expired", () => {
    const expired = pin("d", 1, new Date(NOW.getTime() - 48 * hour), new Date(NOW.getTime() - hour));
    expect(ids(applyPins(ads, [expired], idOf, NOW))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("ignores a pin that has not started yet", () => {
    const future = pin("d", 1, new Date(NOW.getTime() + hour), null);
    expect(ids(applyPins(ads, [future], idOf, NOW))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("uses a pin that is inside its window", () => {
    const current = pin("e", 2, new Date(NOW.getTime() - hour), new Date(NOW.getTime() + hour));
    expect(ids(applyPins(ads, [current], idOf, NOW))).toEqual(["a", "e", "b", "c", "d"]);
  });

  it("ignores a pin for an ad that is not in the feed", () => {
    expect(ids(applyPins(ads, [pin("zzz", 1)], idOf, NOW))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("handles several pins and a position past the end without changing the input", () => {
    const input = [...ads];
    expect(ids(applyPins(input, [pin("c", 1), pin("a", 99)], idOf, NOW))).toEqual(["c", "b", "d", "e", "a"]);
    expect(input).toEqual(ads);
  });

  it("only gives a scope to plain home and hub feeds", () => {
    expect(pinScopeOf({})).toBe("home");
    expect(pinScopeOf({ categorySlug: "Property" })).toBe("hub:property");
    expect(pinScopeOf({ categorySlug: "property", citySlug: "surat", districtSlug: "adajan" })).toBe("hub:property/surat/adajan");
    expect(pinScopeOf({ citySlug: "surat" })).toBeNull();
    expect(pinScopeOf({ categorySlug: "property", q: "flat" })).toBeNull();
    expect(pinScopeOf({ categorySlug: "property", excludeSlug: "x" })).toBeNull();
  });
});
