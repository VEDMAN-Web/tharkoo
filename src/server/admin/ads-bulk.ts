import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { dateWords } from "@/lib/admin/history-words";
import { can, type Perm } from "@/lib/admin/perms";
import { BULK_MAX, BULK_TYPED_FROM, EXTEND_HOURS, EXPIRE_IN_HOURS, SET_END_MAX_DAYS } from "@/lib/admin/ads-bulk-rules";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { adminWrite } from "@/server/admin/write";
import { ForbiddenError, ValidationError } from "@/server/http";
import { revalidateListingPages } from "@/server/listings/revalidate";
import { AuditEvent, Category, Listing } from "@/server/models";
import type { ListingDoc } from "@/server/models/listing";
import { textDenied } from "@/server/shared/policy";

export const BULK_ACTIONS = ["pause", "resume", "extend", "setEnd", "expireIn", "endNow", "remove"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
const NO_EXPIRY = "none";
const REASON_MAX = 500;

type Status = ListingDoc["status"];
type Rule = { perm: Perm; from: Status[]; to: Status; action: string; word: string; window: "edits" | "decisions"; reasonRequired: boolean };

const RULES: Record<BulkAction, Rule> = {
  pause: { perm: "ads.edit", from: ["active"], to: "paused", action: "listing.pause", word: "Paused", window: "decisions", reasonRequired: false },
  resume: { perm: "ads.edit", from: ["paused"], to: "active", action: "listing.resume", word: "Resumed", window: "decisions", reasonRequired: false },
  extend: { perm: "ads.edit", from: ["active", "paused", "expired"], to: "active", action: "listing.extend", word: "Extended", window: "edits", reasonRequired: false },
  setEnd: { perm: "ads.edit", from: ["active", "paused", "expired"], to: "active", action: "listing.set_end", word: "End time set", window: "edits", reasonRequired: false },
  expireIn: { perm: "ads.edit", from: ["active", "paused", "expired"], to: "active", action: "listing.set_end", word: "End time set", window: "edits", reasonRequired: false },
  endNow: { perm: "ads.edit", from: ["active", "paused"], to: "expired", action: "listing.end_now", word: "Ended now", window: "decisions", reasonRequired: true },
  remove: { perm: "ads.decide", from: ["active", "paused", "pending", "expired", "archived"], to: "removed", action: "listing.remove", word: "Removed", window: "decisions", reasonRequired: true },
};

export type BulkSkip = { id: string; title: string; why: string };
export type BulkResult = { batchId: string; changed: number; skipped: BulkSkip[]; eventIds: string[] };

export function typedConfirmFor(count: number): string {
  return String(count);
}

function iso(date: Date | undefined | null): string {
  return date ? new Date(date).toISOString() : NO_EXPIRY;
}

async function categorySlug(cache: Map<string, string | undefined>, id: Types.ObjectId): Promise<string | undefined> {
  const key = String(id);
  if (!cache.has(key)) cache.set(key, (await Category.findById(id).select("slug").lean<{ slug?: string }>())?.slug);
  return cache.get(key);
}

const HOUR_MS = 60 * 60 * 1000;

type EndInput = { hours?: number; endsAt?: string };

/** The extra input an end-time action needs, checked once for the whole batch. Returns the parsed end for "setEnd". */
function endInput(action: BulkAction, input: EndInput): { hours: number; endsAt: Date | null } {
  if (action === "extend" || action === "expireIn") {
    const allowed: readonly number[] = action === "extend" ? EXTEND_HOURS : EXPIRE_IN_HOURS;
    const hours = Number(input.hours ?? (action === "extend" ? EXTEND_HOURS[EXTEND_HOURS.length - 1] : Number.NaN));
    if (!allowed.includes(hours)) throw new ValidationError("Choose one of the lengths in the list");
    return { hours, endsAt: null };
  }
  if (action === "setEnd") {
    const endsAt = new Date(String(input.endsAt ?? ""));
    if (Number.isNaN(endsAt.getTime())) throw new ValidationError("Pick a date and time");
    if (endsAt.getTime() <= Date.now()) throw new ValidationError("Pick a time in the future. To end an ad now, use End now.");
    if (endsAt.getTime() > Date.now() + SET_END_MAX_DAYS * 24 * HOUR_MS) throw new ValidationError(`Pick a time within ${SET_END_MAX_DAYS} days`);
    return { hours: 0, endsAt };
  }
  return { hours: 0, endsAt: null };
}

function nextEnd(action: BulkAction, was: Date | undefined | null, parsed: { hours: number; endsAt: Date | null }, now: number): Date | undefined {
  if (action === "extend") return new Date(Math.max(was ? new Date(was).getTime() : 0, now) + parsed.hours * HOUR_MS);
  if (action === "expireIn") return new Date(now + parsed.hours * HOUR_MS);
  if (action === "setEnd") return parsed.endsAt ?? undefined;
  if (action === "endNow") return new Date(now);
  return undefined;
}

async function check(ctx: AdminCtx, action: BulkAction, ids: string[], reason: string, confirm: string) {
  const rule = RULES[action];
  if (!can(ctx.roles, rule.perm)) {
    await adminWrite(ctx, {
      perm: rule.perm,
      action: rule.action,
      target: { type: "listing", id: ids[0] ?? "bulk" },
      before: async () => null,
      apply: async () => ({ after: null, result: null, summary: "" }),
    });
    throw new ForbiddenError("You do not have permission to do this");
  }
  if (ids.length < 1) throw new ValidationError("Select at least one ad");
  if (ids.length > BULK_MAX) throw new ValidationError(`Select at most ${BULK_MAX} ads at a time`);
  if (ids.some((id) => !Types.ObjectId.isValid(id))) throw new ValidationError("Invalid request");
  if (rule.reasonRequired && (reason.length < 1 || reason.length > REASON_MAX)) throw new ValidationError(`Give a reason of 1 to ${REASON_MAX} characters`);
  if (textDenied(reason).denied) throw new ValidationError("This text is not allowed on Tharkoo");
  if (action === "remove" && ids.length >= BULK_TYPED_FROM && confirm.trim() !== typedConfirmFor(ids.length)) {
    throw new ValidationError(`Type ${typedConfirmFor(ids.length)} to confirm removing ${ids.length} ads`);
  }
}

/**
 * Pause, resume, extend or remove up to 100 ads (H8.27). Each ad is its own audited write with the same batch id,
 * so History shows every row and Undo can bring the whole batch back. Ads in the wrong state are skipped and listed.
 * Credits are never given back from here: open the ad and use Reject or Remove to do that.
 */
export async function bulkChangeAds(ctx: AdminCtx, input: { action: BulkAction; ids: string[]; reason?: string; confirm?: string; hours?: number; endsAt?: string }): Promise<BulkResult> {
  await connectDb();
  const action = input.action;
  const rule = RULES[action];
  const ids = Array.from(new Set(input.ids.map(String)));
  const reason = (input.reason ?? "").trim();
  await check(ctx, action, ids, reason, input.confirm ?? "");
  const parsed = endInput(action, input);
  const batchId = crypto.randomUUID();
  const slugs = new Map<string, string | undefined>();
  const skipped: BulkSkip[] = [];
  const eventIds: string[] = [];
  for (const id of ids) {
    const listing = await Listing.findById(id);
    if (!listing) {
      skipped.push({ id, title: "", why: "Not found" });
      continue;
    }
    if (!rule.from.includes(listing.status)) {
      skipped.push({ id, title: listing.title, why: `It is ${listing.status}` });
      continue;
    }
    const was = { status: listing.status, expiresAt: listing.expiresAt };
    try {
      const written = await adminWrite(ctx, {
        perm: rule.perm,
        action: rule.action,
        target: { type: "listing", id, label: listing.title },
        reason: reason || undefined,
        reasonRequired: rule.reasonRequired,
        undo: { kind: "listing.decision", windowKey: rule.window },
        batchId,
        before: async () => ({ status: was.status, expiresAt: iso(was.expiresAt) }),
        apply: async () => {
          const changesEnd = ["extend", "setEnd", "expireIn"].includes(action);
          if (!changesEnd || was.status === "expired") listing.status = rule.to;
          const end = nextEnd(action, was.expiresAt, parsed, Date.now());
          if (end) listing.expiresAt = end;
          await listing.save();
          await revalidateListingPages(listing, await categorySlug(slugs, listing.categoryId));
          const touchesEnd = ["extend", "setEnd", "expireIn", "endNow"].includes(action);
          return {
            after: { status: listing.status, expiresAt: iso(listing.expiresAt) },
            result: null,
            summary: touchesEnd ? `${rule.word}, ends ${listing.expiresAt ? dateWords(listing.expiresAt) : NO_EXPIRY}: ${listing.title}` : `${rule.word}: ${listing.title}`,
            undoData: { id, from: listing.status, to: was.status, refund: null, ...(touchesEnd ? { expiresTo: iso(was.expiresAt) } : {}) },
          };
        },
      });
      if (written.eventId) eventIds.push(written.eventId);
    } catch (error) {
      console.error("bulk ad change failed", { action, id, error: error instanceof Error ? error.message : error });
      skipped.push({ id, title: listing.title, why: "Could not be changed" });
    }
  }
  return { batchId, changed: eventIds.length, skipped, eventIds };
}

export type BatchUndoResult = { restored: number; failed: string[] };

/** Undo every row of one batch. Only events that carry that batch id are touched. Rows that cannot be undone (changed since, window over) are listed. */
export async function undoAdsBatch(ctx: AdminCtx, input: { batchId: string; eventIds: string[] }): Promise<BatchUndoResult> {
  await connectDb();
  const ids = Array.from(new Set(input.eventIds.map(String))).filter((id) => Types.ObjectId.isValid(id));
  if (ids.length < 1 || ids.length > BULK_MAX || !input.batchId) throw new ValidationError("Invalid request");
  const owned = await AuditEvent.countDocuments({ _id: { $in: ids }, batchId: input.batchId });
  if (owned !== ids.length) throw new ValidationError("Invalid request");
  let restored = 0;
  const failed: string[] = [];
  for (const id of ids) {
    const outcome = await undoEvent(ctx, id);
    if (outcome.ok) restored += 1;
    else failed.push(outcome.message);
  }
  return { restored, failed };
}
