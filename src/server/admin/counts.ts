import type { Types } from "mongoose";
import { cached } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { can, type Perm } from "@/lib/admin/perms";
import type { AdminCounts } from "@/lib/admin/count-sum";
import type { CountId } from "@/lib/admin/screens";
import { demoFilter } from "@/server/listings/demo-ads";
import { IdentityVerification, Listing, MediaAsset, Payment, Report, Site } from "@/server/models";
import { ContentItem } from "@/server/models/content";
import { SupportTicket } from "@/server/models/support";
import { Withdrawal } from "@/server/wallet/withdrawals";

export const COUNT_TTL_MS = 30_000;
export const RECHARGE_CHECK_AFTER_MS = 30 * 60 * 1000;

export const COUNT_PERMS: Record<CountId, Perm> = {
  reviewLive: "ads.review",
  reviewHeld: "ads.review",
  reviewEdited: "ads.review",
  reports: "reports.handle",
  legal: "reports.legal",
  idChecks: "id.decide",
  tickets: "desk.work",
  recharges: "orders.view",
  payouts: "payouts.decide",
  contentReview: "content.publish",
};

export const COUNT_IDS = Object.keys(COUNT_PERMS) as CountId[];

export function countsForRoles(roles: readonly string[] | undefined): CountId[] {
  return COUNT_IDS.filter((id) => can(roles, COUNT_PERMS[id]));
}

type NotDemo = { $nor: object[] };

async function notDemo(): Promise<NotDemo | Record<string, never>> {
  const demo = await demoFilter();
  return demo ? { $nor: [demo] } : {};
}

async function reviewLive(skip: NotDemo | Record<string, never>) {
  const site = await Site.findOne().select("postModerationSince").lean<{ postModerationSince?: Date | null } | null>();
  const since = site?.postModerationSince;
  if (!since) return 0;
  return Listing.countDocuments({ ...skip, status: "active", lastModerationAt: { $exists: false }, publishedAt: { $gt: since } });
}

async function reviewEdited(skip: NotDemo | Record<string, never>) {
  const waiting = await MediaAsset.distinct("listingId", { kind: "image", status: "scanning", listingId: { $ne: null } });
  if (waiting.length === 0) return 0;
  return Listing.countDocuments({ ...skip, status: "active", _id: { $in: waiting as Types.ObjectId[] } });
}

const LOADERS: Record<CountId, (skip: NotDemo | Record<string, never>) => Promise<number>> = {
  reviewLive,
  reviewHeld: (skip) => Listing.countDocuments({ ...skip, status: "pending" }),
  reviewEdited,
  reports: () => Report.countDocuments({ status: { $in: ["open", "ack"] }, source: { $ne: "legal" } }),
  legal: () => Report.countDocuments({ status: { $in: ["open", "ack"] }, source: "legal" }),
  idChecks: () => IdentityVerification.countDocuments({ status: "pending_review" }),
  tickets: () => SupportTicket.countDocuments({ status: { $in: ["open", "waiting_for_support"] } }),
  recharges: () =>
    Payment.countDocuments({ status: "pending", provider: { $ne: "mock" }, createdAt: { $lt: new Date(Date.now() - RECHARGE_CHECK_AFTER_MS) } }),
  payouts: () => Withdrawal.countDocuments({ status: "requested" }),
  contentReview: () => ContentItem.countDocuments({ status: "review" }),
};

async function load(ids: CountId[]): Promise<AdminCounts> {
  await connectDb();
  const skip = ids.some((id) => id.startsWith("review")) ? await notDemo() : {};
  const entries = await Promise.all(ids.map(async (id) => [id, await LOADERS[id](skip)] as const));
  return Object.fromEntries(entries);
}

/** The numbers beside sidebar items. Only the counters this role may see; demo ads are never counted; kept for 30 seconds. */
export async function getAdminCounts(roles: readonly string[] | undefined): Promise<AdminCounts> {
  const ids = countsForRoles(roles);
  if (ids.length === 0) return {};
  return cached(`admin-counts:${ids.join(",")}`, COUNT_TTL_MS, () => load(ids));
}
