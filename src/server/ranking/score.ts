/** Paid placement, then verified, then freshness. Pure so T5.1 can sort without this module touching Mongo.
 *  Optional `settings` (H3.8) change the tier order and the verified/photo toggles; without them the order is the original one. */

import type { RankSettings } from "@/server/ranking/settings";

export interface RankListing {
  verified?: boolean;
  badges?: readonly string[];
  bumpedAt?: Date | string | number | null;
  publishedAt?: Date | string | number | null;
  hasPhoto?: boolean;
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
  photo: number;
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

/** Tier value for a promotion code. With `tierOrder`, earlier means stronger; no promotion counts as "free". */
function tierValue(code: string, tierOrder?: readonly string[]) {
  if (!tierOrder) return TIER[code] ?? 0;
  const index = tierOrder.indexOf(code);
  return index < 0 ? 0 : tierOrder.length - index;
}

export function rankScore(
  listing: RankListing,
  promotions: readonly RankPromotion[],
  now: Date,
  settings?: Pick<RankSettings, "tierOrder">,
): RankScore {
  const nowMs = now.getTime();
  const tierOrder = settings?.tierOrder;
  let tier: number | null = null;
  for (const promotion of promotions) {
    if (promotion.status !== "active") continue;
    if (promotion.startsAt && millis(promotion.startsAt) > nowMs) continue;
    const end = millis(promotion.endsAt);
    if (!promotion.endsAt || end <= nowMs) continue;
    const rank = tierValue(promotion.code.trim().toLowerCase(), tierOrder);
    if (tier === null || rank > tier) tier = rank;
  }
  const bumped = millis(listing.bumpedAt);
  const published = millis(listing.publishedAt);
  const verified = listing.verified === true || listing.badges?.includes("verified") === true;
  return { tier: tier ?? tierValue("free", tierOrder), verified: verified ? 1 : 0, photo: listing.hasPhoto ? 1 : 0, freshness: bumped || published };
}

/** Negative when `left` should sort first. Order: tier, verified (if on), photo (if on), freshness. */
export function compareRank(
  left: RankScore,
  right: RankScore,
  settings?: Pick<RankSettings, "verifiedFirst" | "photoFirst">,
) {
  const verifiedFirst = settings?.verifiedFirst !== false;
  const photoFirst = settings?.photoFirst === true;
  return (
    right.tier - left.tier ||
    (verifiedFirst ? right.verified - left.verified : 0) ||
    (photoFirst ? right.photo - left.photo : 0) ||
    right.freshness - left.freshness
  );
}
