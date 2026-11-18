/**
 * H11.1: the shapes and the arithmetic of the "What things cost" card. Values come from live settings and plan data, never from here.
 * Rupees first, credits second: a credit is worth `creditPriceInr` rupees.
 */

export type PlanPrice = { name: string; credits: number; hours: number };

export type PriceListData = {
  creditPriceInr: number;
  paidPostingOn: boolean;
  /** Credits an ad costs after the free ones (the posting fee). */
  adFee: number;
  /** Free ads for this account: the site setting plus any extra free ads (the setting alone for a visitor). */
  freeAds: number;
  /** Free ads this account has left, or null for a visitor who is not signed in. */
  freeLeft: number | null;
  /** TOP and Super Top, read by their plan slugs. Null when the plan does not exist, is hidden or has no price. */
  top: PlanPrice | null;
  superTop: PlanPrice | null;
};

export type EnoughFor = { ads: number | null; top: number | null; superTop: number | null };

/** Whole items a number of credits buys, rounded down. Null when there is nothing to count (no plan, or a price of 0). */
export function wholeItems(credits: number, price: number | null | undefined): number | null {
  if (!Number.isFinite(credits) || typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
  return Math.max(0, Math.floor(credits / price));
}

/** "Enough for 10 ads, or 4 TOP, or 2 Super Top": what a pack (credits plus its free bonus) buys, each rounded down. */
export function enoughFor(totalCredits: number, list: Pick<PriceListData, "adFee" | "top" | "superTop">): EnoughFor {
  return { ads: wholeItems(totalCredits, list.adFee), top: wholeItems(totalCredits, list.top?.credits), superTop: wholeItems(totalCredits, list.superTop?.credits) };
}

export function rupeesOf(credits: number, creditPriceInr: number): number {
  return Math.round(credits * creditPriceInr);
}
