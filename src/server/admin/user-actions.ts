import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import type { AdminCtx } from "@/server/admin/context";
import { eventIsUndone } from "@/server/admin/undo/core";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/http";
import { revalidateListingPages } from "@/server/listings/revalidate";
import { AuditEvent, Category, Listing, Session, User } from "@/server/models";
import { STAFF_ROLE_NAMES } from "@/server/models/identity";

/** H8.11 (A11): ban, unban and log out everywhere. Every write goes through adminWrite (permission, reason, terms, audit). */

const MAX_REVALIDATE = 100;
const BAN_EVENTS_LOOKED_AT = 5;

export type BanData = { pausedListingIds: string[] };
export type UserActionResult = { eventId: string; undoUntil: string | null; summary: string };

async function loadUser(userId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(userId)) throw new NotFoundError("Not found");
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("Not found");
  return user;
}

/** Pages that showed these ads are refreshed so a banned seller's ads disappear at once. Never fails the ban. */
export async function refreshAdPages(ids: readonly string[]) {
  if (ids.length === 0) return;
  try {
    const rows = await Listing.find({ _id: { $in: ids.slice(0, MAX_REVALIDATE) } }).select("slug cityId districtId categoryId").lean();
    const categories = await Category.find({ _id: { $in: rows.map((row) => row.categoryId) } }).select("slug").lean();
    const slugs = new Map(categories.map((category) => [String(category._id), category.slug as string]));
    for (const row of rows) await revalidateListingPages(row, slugs.get(String(row.categoryId)));
  } catch (error) {
    console.error("admin.users.revalidate_failed", error instanceof Error ? error.message : error);
  }
}

/** Stops every live sign-in of a user. Sessions are never brought back: the person signs in again. */
export async function revokeSessions(userId: Types.ObjectId | string): Promise<number> {
  const result = await Session.updateMany({ userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  return result.modifiedCount;
}

/** Counts what a ban would pause, for the dialog: only ads that are live now. */
export async function banPreview(userId: string): Promise<{ liveAds: number; sessions: number }> {
  await connectDb();
  if (!mongoose.isValidObjectId(userId)) return { liveAds: 0, sessions: 0 };
  const [liveAds, sessions] = await Promise.all([
    Listing.countDocuments({ ownerId: userId, status: "active" }),
    Session.countDocuments({ userId, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }),
  ]);
  return { liveAds, sessions };
}

/**
 * Bans a user: status "suspended", their live ads paused (the ids are kept in the undo data), every session ended.
 * Undo for 7 days brings back only the ads this ban paused. Ads the seller had paused before stay paused.
 */
export async function banUser(ctx: AdminCtx, input: { userId: string; reason: string }): Promise<UserActionResult> {
  const user = await loadUser(input.userId);
  if (String(user._id) === ctx.actorId) throw new ForbiddenError("You cannot ban your own account");
  if (user.roles.some((role) => STAFF_ROLE_NAMES.has(role))) throw new ForbiddenError("Staff accounts are changed in Team and roles, not here");
  if (user.status === "suspended") throw new ConflictError("This user is already banned");
  if (user.status === "deleted") throw new ConflictError("This account was deleted");
  const written = await adminWrite(ctx, {
    perm: "users.ban",
    action: "user.ban",
    target: { type: "user", id: String(user._id), label: user.displayName },
    reason: input.reason,
    reasonRequired: true,
    texts: [input.reason],
    undo: { kind: "user.ban", windowKey: "decisions" },
    before: async () => ({ status: user.status }),
    apply: async () => {
      const live = await Listing.find({ ownerId: user._id, status: "active" }).select("_id").lean();
      const ids = live.map((row) => String(row._id));
      if (ids.length) await Listing.updateMany({ _id: { $in: ids }, status: "active" }, { $set: { status: "paused" } });
      await User.updateOne({ _id: user._id }, { $set: { status: "suspended" } });
      const ended = await revokeSessions(user._id);
      return {
        after: { status: "suspended", pausedListings: ids.length, sessionsEnded: ended },
        result: ids,
        undoData: { pausedListingIds: ids } satisfies BanData,
        summary: `Banned ${user.displayName}: ${ids.length} ${ids.length === 1 ? "ad" : "ads"} paused, ${ended} ${ended === 1 ? "sign-in" : "sign-ins"} ended`,
      };
    },
  });
  await refreshAdPages(written.result);
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Banned ${user.displayName}` };
}

/** The ids the latest ban of this user paused, when that ban was not undone. Empty when there is none. */
async function idsPausedByLatestBan(userId: string): Promise<string[]> {
  const events = await AuditEvent.find({ action: "user.ban", targetType: "user", targetId: userId })
    .sort({ _id: -1 })
    .limit(BAN_EVENTS_LOOKED_AT)
    .select("undo")
    .lean<{ _id: Types.ObjectId; undo?: { data?: Partial<BanData> } }[]>();
  for (const event of events) {
    if (await eventIsUndone(String(event._id))) continue;
    const ids = event.undo?.data?.pausedListingIds;
    return Array.isArray(ids) ? ids.map(String) : [];
  }
  return [];
}

/** Unbans a user and resumes only the ads that the ban paused (and that are still paused). Sessions stay ended. */
export async function unbanUser(ctx: AdminCtx, input: { userId: string; reason?: string }): Promise<UserActionResult> {
  const user = await loadUser(input.userId);
  if (user.status !== "suspended") throw new ConflictError("This user is not banned");
  const written = await adminWrite(ctx, {
    perm: "users.ban",
    action: "user.unban",
    target: { type: "user", id: String(user._id), label: user.displayName },
    reason: input.reason,
    texts: [input.reason],
    before: async () => ({ status: user.status }),
    apply: async () => {
      const ids = await idsPausedByLatestBan(String(user._id));
      let resumed: string[] = [];
      if (ids.length) {
        const rows = await Listing.find({ _id: { $in: ids }, ownerId: user._id, status: "paused" }).select("_id").lean();
        resumed = rows.map((row) => String(row._id));
        if (resumed.length) await Listing.updateMany({ _id: { $in: resumed } }, { $set: { status: "active" } });
      }
      await User.updateOne({ _id: user._id }, { $set: { status: "active" } });
      return {
        after: { status: "active", resumedListings: resumed.length },
        result: resumed,
        summary: `Unbanned ${user.displayName}: ${resumed.length} ${resumed.length === 1 ? "ad" : "ads"} live again`,
      };
    },
  });
  await refreshAdPages(written.result);
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Unbanned ${user.displayName}` };
}

/** Ends every sign-in of a user, on every device. They can sign in again with a code. */
export async function logoutEverywhere(ctx: AdminCtx, input: { userId: string }): Promise<UserActionResult> {
  const user = await loadUser(input.userId);
  const written = await adminWrite(ctx, {
    perm: "users.logout",
    action: "user.logout_everywhere",
    target: { type: "user", id: String(user._id), label: user.displayName },
    before: async () => ({ status: user.status }),
    apply: async () => {
      const ended = await revokeSessions(user._id);
      return { after: { sessionsEnded: ended }, result: ended, summary: `Logged ${user.displayName} out on every device (${ended} ${ended === 1 ? "sign-in" : "sign-ins"})` };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `${user.displayName} is logged out everywhere` };
}
