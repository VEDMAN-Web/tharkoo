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

/** "Ad 1", "Ads 1 and 2", "Ads 1, 2 and 3", "Ads 1 to 6": the free ads of an account, from the live number. Empty when there are none. */
export function freeAdsTitle(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "Ad 1";
  if (count === 2) return "Ads 1 and 2";
  if (count === 3) return "Ads 1, 2 and 3";
  return `Ads 1 to ${count}`;
}

/** The title of the paid row: "Ad 4 and every ad after", or "Every ad" when no ad is free. */
export function afterFreeTitle(freeAds: number): string {
  return freeAds > 0 ? `Ad ${freeAds + 1} and every ad after` : "Every ad";
}

export const rupeeText = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** The one-line version: "2 free ads left, then ₹200 per ad". Null while posting is free for everyone or the ad price is not set. */
export function priceOneLine(list: PriceListData): string | null {
  if (!list.paidPostingOn || list.adFee <= 0) return null;
  const price = rupeeText(rupeesOf(list.adFee, list.creditPriceInr));
  if (list.freeLeft !== null && list.freeLeft > 0) return `${count(list.freeLeft, "free ad left", "free ads left")}, then ${price} per ad`;
  if (list.freeLeft === null && list.freeAds > 0) return `${count(list.freeAds, "free ad", "free ads")}, then ${price} per ad`;
  return `Each new ad costs ${price} (${count(list.adFee, "credit", "credits")})`;
}

/** "Enough for 10 ads, or 4 TOP, or 2 Super Top": the parts that exist, in that order. Empty when nothing can be said. */
export function enoughParts(enough: EnoughFor, list: Pick<PriceListData, "paidPostingOn" | "top" | "superTop">): { text: string; strong: boolean }[] {
  const parts: { text: string; strong: boolean }[] = [];
  if (list.paidPostingOn && enough.ads !== null && enough.ads >= 1) parts.push({ text: count(enough.ads, "ad", "ads"), strong: true });
  if (list.top && enough.top !== null && enough.top >= 1) parts.push({ text: `${enough.top.toLocaleString("en-IN")} ${list.top.name}`, strong: parts.length === 0 });
  if (list.superTop && enough.superTop !== null && enough.superTop >= 1) parts.push({ text: `${enough.superTop.toLocaleString("en-IN")} ${list.superTop.name}`, strong: parts.length === 0 });
  return parts;
}
