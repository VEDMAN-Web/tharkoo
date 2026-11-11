import type { RankListing, RankPromotion } from "@/server/ranking";

/** Fixed clock so the fixture never drifts. */
export const NOW = new Date("2026-06-15T12:00:00.000Z");
const HOUR = 3_600_000;
const CODES = ["star", "super-top", "flash", "top", "highlight", "new", "auto-boost", "free"] as const;

export interface FixtureRow {
  slug: string;
  listing: RankListing & { hasPhoto?: boolean };
  promotions: RankPromotion[];
}

/** 30 listings with a repeatable mix of paid tiers, expired/future promotions, verified flags and ages. */
export function fixtureRows(): FixtureRow[] {
  let seed = 20260615;
  const next = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  return Array.from({ length: 30 }, (_, i) => {
    const slug = `ad-${String(i + 1).padStart(2, "0")}`;
    const published = NOW.getTime() - (next(300) + 1) * HOUR;
    const bumped = next(3) === 0 ? NOW.getTime() - (next(100) + 1) * HOUR : null;
    const code = CODES[next(CODES.length)];
    const state = next(4);
    const promotions: RankPromotion[] =
      state === 3
        ? []
        : [
            {
              code,
              status: state === 2 ? "expired" : "active",
              startsAt: new Date(NOW.getTime() - 48 * HOUR),
              endsAt: new Date(NOW.getTime() + (state === 1 ? -HOUR : 24 * HOUR)),
            },
          ];
    return {
      slug,
      listing: {
        badges: next(3) === 0 ? ["verified"] : [],
        bumpedAt: bumped === null ? null : new Date(bumped),
        publishedAt: new Date(published),
        hasPhoto: next(2) === 0,
      },
      promotions,
    };
  });
}
