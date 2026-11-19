import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { cached, refreshPublicCache } from "@/lib/cache";
import { isAdminRole } from "@/lib/ui/site-content";
import { can } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { eventIsUndone } from "@/server/admin/undo/core";
import { undoWindowDays } from "@/server/admin/undo/registry";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, Listing, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";

export const DEMO_SLUG = /^demo-[0-9]{1,6}$/;
export function isDemoAd(ownerEmail: string | undefined, slug: string | undefined): boolean {
  return ownerEmail === SEED_USER_EMAIL && DEMO_SLUG.test(slug ?? "");
}

export const DEMO_END_STATUS = "expired";

/** The id of the account that owns every demo ad, or null when there is none. Cached a minute: it is read on every list query. */
export async function demoOwnerId(): Promise<string | null> {
  return cached(
    "demo-owner",
    60_000,
    async () => {
      await connectDb();
      const seed = await User.findOne({ email: SEED_USER_EMAIL }).select("_id").lean<{ _id: Types.ObjectId } | null>();
      return seed ? String(seed._id) : null;
    },
    ["site"],
  );
}
const SAMPLE = 20;

export async function demoFilter(): Promise<{ ownerId: Types.ObjectId; slug: { $regex: string } } | null> {
  await connectDb();
  const seed = await User.findOne({ email: SEED_USER_EMAIL }).select("_id").lean<{ _id: Types.ObjectId } | null>();
  if (!seed) return null;
  return { ownerId: seed._id, slug: { $regex: DEMO_SLUG.source } };
}

export async function demoAdCounts(): Promise<{ total: number; active: number }> {
  await connectDb();
  const filter = await demoFilter();
  if (!filter) return { total: 0, active: 0 };
  const [total, active] = await Promise.all([Listing.countDocuments(filter), Listing.countDocuments({ ...filter, status: "active" })]);
  return { total, active };
}

export function endConfirmation(count: number): string {
  return `END ${count}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function ctxOf(input: { actorId: string; roles: readonly string[]; requestId: string }): AdminCtx {
  return { actorId: input.actorId, email: "", roles: [...input.roles], requestId: input.requestId };
}

/** Ends every live demo ad in one batch. The batch id stays on the ads, so Restore brings back only these and never an ad that expired by itself. */
export async function endDemoAds(input: { actorId: string; roles: readonly string[]; confirm: unknown; requestId: string }) {
  if (!isAdminRole([...input.roles])) throw new ForbiddenError("Only an admin can end demo ads");
  await connectDb();
  const filter = await demoFilter();
  const active = filter ? await Listing.find({ ...filter, status: "active" }).select("_id slug").lean<{ _id: Types.ObjectId; slug?: string }[]>() : [];
  if (!filter || active.length === 0) throw new ConflictError("There are no active demo ads to end.");
  const typed = typeof input.confirm === "string" ? input.confirm.trim() : "";
  if (typed !== endConfirmation(active.length)) {
    throw new ValidationError("Invalid request", { confirm: [`Type ${endConfirmation(active.length)} to confirm.`] });
  }
  const ids = active.map((row) => row._id);
  const batch = randomUUID();
  const written = await adminWrite<{ ended: number }>(ctxOf(input), {
    perm: "ads.demo.end",
    action: "listing.demo.end",
    target: { type: "listing", id: "demo-ads" },
    undo: { kind: "demo.end", windowKey: "demo" },
    before: async () => ({ active: active.length }),
    apply: async () => {
      const result = await Listing.updateMany({ ...filter, _id: { $in: ids }, status: "active" }, { $set: { status: DEMO_END_STATUS, demoEndedBatch: batch } });
      return {
        after: { ended: result.modifiedCount, status: DEMO_END_STATUS, batch, sample: active.slice(0, SAMPLE).map((row) => row.slug ?? String(row._id)) },
        result: { ended: result.modifiedCount },
        summary: `Ended ${result.modifiedCount} demo ${result.modifiedCount === 1 ? "ad" : "ads"}`,
        undoData: { batch },
      };
    },
  });
  await refreshPublicCache();
  return { ended: written.result.ended, eventId: written.eventId, undoUntil: written.undoUntil };
}

export type EndedDemoBatch = { batchId: string; endedAt: string; restoreUntil: string; count: number; canRestore: boolean };

/** The newest end of the demo ads that still has ads waiting: when it happened, how many, and whether the days to bring them back are over. */
export async function lastEndedDemoBatch(): Promise<EndedDemoBatch | null> {
  await connectDb();
  const events = await AuditEvent.find({ action: "listing.demo.end", "after.batch": { $exists: true } })
    .sort({ _id: -1 })
    .limit(5)
    .select("after createdAt")
    .lean<{ _id: Types.ObjectId; after?: { batch?: string }; createdAt?: Date }[]>();
  const days = await undoWindowDays("demo");
  for (const event of events) {
    const batchId = event.after?.batch;
    if (!batchId || (await eventIsUndone(String(event._id)))) continue;
    const count = await Listing.countDocuments({ demoEndedBatch: batchId, status: DEMO_END_STATUS });
    if (count === 0) continue;
    const endedAt = new Date(event.createdAt ?? Date.now());
    const until = new Date(endedAt.getTime() + days * DAY_MS);
    return { batchId, endedAt: endedAt.toISOString(), restoreUntil: until.toISOString(), count, canRestore: until.getTime() > Date.now() };
  }
  return null;
}

/** Puts back the ads of one ended batch that are still ended. An ad that expired by itself has no batch id and is never touched. */
export async function reviveDemoBatch(batchId: string): Promise<number> {
  await connectDb();
  const filter = await demoFilter();
  if (!filter || !batchId) return 0;
  const result = await Listing.updateMany({ ...filter, demoEndedBatch: batchId, status: DEMO_END_STATUS }, { $set: { status: "active" }, $unset: { demoEndedBatch: "" } });
  await refreshPublicCache();
  return result.modifiedCount;
}

/** Superadmin only, and only in the days after the end. Brings back the newest ended batch. */
export async function restoreDemoAds(ctx: AdminCtx): Promise<{ restored: number }> {
  await connectDb();
  if (!can(ctx.roles, "ads.demo.restore")) {
    await adminWrite(ctx, { perm: "ads.demo.restore", action: "listing.demo.restore", target: { type: "listing", id: "demo-ads" }, before: async () => null, apply: async () => ({ after: null, result: null, summary: "" }) });
  }
  const last = await lastEndedDemoBatch();
  if (!last) throw new ConflictError("There are no ended demo ads to bring back.");
  if (!last.canRestore) throw new ConflictError("The days to bring the demo ads back are over.");
  const written = await adminWrite<{ restored: number }>(ctx, {
    perm: "ads.demo.restore",
    action: "listing.demo.restore",
    target: { type: "listing", id: "demo-ads" },
    before: async () => ({ ended: last.count }),
    apply: async () => {
      const restored = await reviveDemoBatch(last.batchId);
      return { after: { restored, batch: last.batchId }, result: { restored }, summary: `Brought back ${restored} demo ${restored === 1 ? "ad" : "ads"}` };
    },
  });
  return written.result;
}

export type DemoPanelData = { total: number; active: number; onHome: number; ended: EndedDemoBatch | null };

export async function demoPanelData(): Promise<DemoPanelData> {
  await connectDb();
  const filter = await demoFilter();
  const [counts, onHome, ended] = await Promise.all([
    demoAdCounts(),
    filter ? Listing.countDocuments({ ...filter, status: "active", homeShow: true }) : 0,
    lastEndedDemoBatch(),
  ]);
  return { ...counts, onHome, ended };
}
