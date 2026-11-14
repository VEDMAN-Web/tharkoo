import { z } from "zod";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { shownFrom, type ShownCounts } from "@/server/analytics/shown";
import { AdCounter } from "@/server/models/ad-event";
import { Listing } from "@/server/models/listing";

const audit = new AuditRepository();
const MAX_COUNT = 1_000_000_000;

export const adCountsBodySchema = z
  .object({
    views: z.number().int().min(0).max(MAX_COUNT),
    clicks: z.number().int().min(0).max(MAX_COUNT),
  })
  .strict();

export interface AdCountsView {
  shown: ShownCounts;
  real: ShownCounts;
  set: { views: number; clicks: number };
  setAt: string | null;
  setBy: string | null;
}

/** Shown and real counts for one ad, for the admin screen and the audit row. */
export async function adCountsFor(listingId: string): Promise<AdCountsView> {
  await connectDb();
  const counter = await AdCounter.findOne({ listingId: new Types.ObjectId(listingId) }).lean();
  return {
    shown: shownFrom(counter),
    real: { views: counter?.realViews ?? 0, clicks: counter?.realClicks ?? 0 },
    set: { views: counter?.viewsSet ?? 0, clicks: counter?.clicksSet ?? 0 },
    setAt: counter?.countsSetAt ? new Date(counter.countsSetAt).toISOString() : null,
    setBy: counter?.countsSetBy ?? null,
  };
}

/**
 * H6.17: admin and superadmin only. Sets the shown views and clicks. The real counts are not touched:
 * the server records the real count at this moment, so later visitors add on top of the number set here.
 * The write is one pipeline update, so a view that lands during the save is never lost or counted twice.
 */
export async function setAdCounts(input: {
  listingId: string;
  views: number;
  clicks: number;
  actor: { id: string; roles: string[] };
  requestId: string;
}) {
  if (!isAdminRole(input.actor.roles)) throw new ForbiddenError("Only an admin can change views and clicks");
  const parsed = adCountsBodySchema.safeParse({ views: input.views, clicks: input.clicks });
  if (!parsed.success) throw new ValidationError("Enter whole numbers, 0 or more");
  if (!Types.ObjectId.isValid(input.listingId)) throw new NotFoundError("Ad not found");
  await connectDb();
  const listingId = new Types.ObjectId(input.listingId);
  const exists = await Listing.exists({ _id: listingId });
  if (!exists) throw new NotFoundError("Ad not found");
  const before = await adCountsFor(input.listingId);
  const now = "$$NOW";
  await AdCounter.updateOne(
    { listingId },
    [
      {
        $set: {
          listingId,
          viewsSet: parsed.data.views,
          viewsRealAtSet: { $ifNull: ["$realViews", 0] },
          clicksSet: parsed.data.clicks,
          clicksRealAtSet: { $ifNull: ["$realClicks", 0] },
          realViews: { $ifNull: ["$realViews", 0] },
          realClicks: { $ifNull: ["$realClicks", 0] },
          countsSetAt: now,
          countsSetBy: input.actor.id,
          updatedAt: now,
        },
      },
    ],
    { upsert: true, updatePipeline: true },
  );
  const after = await adCountsFor(input.listingId);
  await audit.append({
    actorId: input.actor.id,
    actorType: "admin",
    action: "ad.counts.update",
    targetType: "listing",
    targetId: input.listingId,
    requestId: input.requestId,
    before: { shown: before.shown, set: before.set, real: before.real },
    after: { shown: after.shown, set: after.set, real: after.real },
  });
  return after;
}
