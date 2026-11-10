/** Paid placement, then verified, then freshness. Pure so T5.1 can sort without this module touching Mongo. */

export interface RankListing {
  verified?: boolean;
  badges?: readonly string[];
  bumpedAt?: Date | string | number | null;
  publishedAt?: Date | string | number | null;
}

export interface RankPromotion {
  code: string;
  status: string;
  startsAt?: Date | string | number | null;
  endsAt?: Date | string | number | null;
}

export interface RankScore {
  tier: number;
  verified: number;
  freshness: number;
}

const TIER: Record<string, number> = {
  star: 80,
  "super-top": 70,
  flash: 60,
  top: 50,
  highlight: 40,
  new: 30,
  "auto-boost": 20,
  free: 0,
};

function millis(value: Date | string | number | null | undefined) {
  if (value == null || value === "") return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function rankScore(
  listing: RankListing,
  promotions: readonly RankPromotion[],
  now: Date,
): RankScore {
  const nowMs = now.getTime();
  let tier = 0;
  for (const promotion of promotions) {
    if (promotion.status !== "active") continue;
    if (promotion.startsAt && millis(promotion.startsAt) > nowMs) continue;
    const end = millis(promotion.endsAt);
    if (!promotion.endsAt || end <= nowMs) continue;
    const rank = TIER[promotion.code.trim().toLowerCase()] ?? 0;
    if (rank > tier) tier = rank;
  }
  const bumped = millis(listing.bumpedAt);
  const published = millis(listing.publishedAt);
  const verified = listing.verified === true || listing.badges?.includes("verified") === true;
  return { tier, verified: verified ? 1 : 0, freshness: bumped || published };
}

/** Negative when `left` should sort first. */
export function compareRank(left: RankScore, right: RankScore) {
  return right.tier - left.tier || right.verified - left.verified || right.freshness - left.freshness;
}
