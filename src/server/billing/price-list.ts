import { connectDb } from "@/lib/db";
import type { PlanPrice, PriceListData } from "@/lib/price-list";
import { extraFreeAdsOf, publishedAdCount } from "@/server/billing/free-ads";
import { promotionRule } from "@/server/billing/catalog";
import { readMoneySettings } from "@/server/billing/money-settings";
import { PromotionProduct } from "@/server/models";

/** The plan slugs the price list reads. A row is left out when its plan does not exist, is hidden or has no price. */
export const TOP_SLUG = "top";
export const SUPER_TOP_SLUG = "super-top";

type ProductRow = { name: string; amount: number; durationDays: number; durationHours?: number; enabled?: boolean };

async function planPrice(code: string): Promise<PlanPrice | null> {
  const row = await PromotionProduct.findOne({ code }).select("name amount durationDays durationHours enabled").lean<ProductRow | null>();
  if (!row || row.enabled === false || !(row.amount > 0)) return null;
  return { name: row.name, credits: Math.round(row.amount), hours: Math.round((promotionRule(code, undefined, row.durationDays, row.durationHours).durationMs / 3_600_000) * 10) / 10 };
}

/** Everything the "What things cost" card needs, from live settings and plan data. `userId` makes the free ads personal. */
export async function readPriceList(userId?: string | null): Promise<PriceListData> {
  await connectDb();
  const [money, top, superTop] = await Promise.all([readMoneySettings(), planPrice(TOP_SLUG), planPrice(SUPER_TOP_SLUG)]);
  let freeAds = money.freeAdsPerAccount;
  let freeLeft: number | null = null;
  if (userId) {
    const [extra, published] = await Promise.all([extraFreeAdsOf(userId), publishedAdCount(userId)]);
    freeAds += extra;
    freeLeft = Math.max(0, freeAds - published);
  }
  return { creditPriceInr: money.creditPriceInr, paidPostingOn: money.paidPostingOn, adFee: money.postingFeeCredits, freeAds, freeLeft, top, superTop };
}
