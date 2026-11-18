import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { readMoneySettings, type MoneySettings } from "@/server/billing/money-settings";
import { Listing, User } from "@/server/models";

/**
 * H11.1: the first ads of every account are free. How many is the setting "Free ads for each account" plus the "Extra free ads"
 * an admin gave one person. Ad number N is free while N is within that allowance; from the next one the posting fee applies.
 * With Paid posting off everything stays free, and the weekly free limit (which only applies then) is checked elsewhere.
 */

export type FreeAdMath = {
  /** Ads this account has published (or has waiting for approval), not counting the one being posted. */
  published: number;
  /** The setting plus this person's extra free ads. */
  allowance: number;
  paidPostingOn: boolean;
  postingFeeCredits: number;
};

export type PostingPlan = {
  /** What the new ad costs in credits: 0 when it is free. */
  fee: number;
  /** True when the new ad is inside the free allowance (or paid posting is off). */
  free: boolean;
  /** The new ad's place in the account's ads: 1 for the first. */
  adNumber: number;
  /** The free allowance: the setting plus extra free ads. */
  allowance: number;
  /** Free ads still to use, counting the new one: 3 for a new account with an allowance of 3. */
  freeLeft: number;
  paidPostingOn: boolean;
};

/** The pure rule, so it can be tested without a database. */
export function postingPlanFor(math: FreeAdMath): PostingPlan {
  const published = Math.max(0, Math.floor(math.published));
  const allowance = Math.max(0, Math.floor(math.allowance));
  const freeLeft = Math.max(0, allowance - published);
  const free = !math.paidPostingOn || freeLeft > 0 || math.postingFeeCredits <= 0;
  return { fee: free ? 0 : math.postingFeeCredits, free, adNumber: published + 1, allowance, freeLeft, paidPostingOn: math.paidPostingOn };
}

/** Ads this account has ever published (a published date), plus ones waiting for approval. Drafts and ads refused before going live do not count. */
export async function publishedAdCount(userId: Types.ObjectId | string, exceptListingId?: Types.ObjectId | string): Promise<number> {
  await connectDb();
  return Listing.countDocuments({
    ownerId: userId,
    ...(exceptListingId ? { _id: { $ne: exceptListingId } } : {}),
    $or: [{ publishedAt: { $ne: null } }, { status: "pending" }],
  });
}

export async function extraFreeAdsOf(userId: Types.ObjectId | string): Promise<number> {
  await connectDb();
  const user = await User.findById(userId).select("extraFreeAds").lean<{ extraFreeAds?: number } | null>();
  const extra = user?.extraFreeAds;
  return typeof extra === "number" && Number.isInteger(extra) && extra > 0 ? extra : 0;
}

/** What the next ad of this account costs, from the live settings and the ads it has already published. */
export async function postingPlanOf(userId: Types.ObjectId | string, input: { listingId?: Types.ObjectId | string; money?: MoneySettings } = {}): Promise<PostingPlan> {
  await connectDb();
  const money = input.money ?? (await readMoneySettings());
  const [published, extra] = await Promise.all([publishedAdCount(userId, input.listingId), extraFreeAdsOf(userId)]);
  return postingPlanFor({ published, allowance: money.freeAdsPerAccount + extra, paidPostingOn: money.paidPostingOn, postingFeeCredits: money.postingFeeCredits });
}
