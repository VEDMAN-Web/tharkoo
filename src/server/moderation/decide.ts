import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { AuditRepository } from "@/server/audit";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, ForbiddenError, NotFoundError, PaymentRequiredError, ValidationError } from "@/server/http";
import { adLifetimeMs } from "@/server/listings/lifetime";
import { revalidateListingPages } from "@/server/listings/revalidate";
import { Category, Listing, ListingVersion, User, WalletEntry } from "@/server/models";
import { debitWallet } from "@/server/billing/ledger";
import { FEE_REF, isPostingFeePaid, refundPostingFee } from "@/server/billing/posting-fee";
import { toSlug } from "@/server/shared/slug";

const audit = new AuditRepository();

async function slugFor(title: string, id: Types.ObjectId) {
  const base = toSlug(title, 60);
  let slug = base;
  for (let n = 2; n < 50; n += 1) {
    if (!(await Listing.exists({ slug, _id: { $ne: id } }))) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${id.toString().slice(-6)}`;
}

async function pendingListing(id: string, roles: string[]) {
  if (!can(roles, "ads.decide")) throw new ForbiddenError("Only a moderator or admin can decide on ads");
  await connectDb();
  const listing = await Listing.findById(id);
  if (!listing) throw new NotFoundError("Ad not found");
  if (listing.status !== "pending") throw new ConflictError(`This ad is ${listing.status}, not waiting for review`);
  return listing;
}

async function actorId(email: string) {
  const user = email ? await User.findOne({ email }).select("_id") : null;
  return user?._id?.toString() ?? null;
}

async function record(email: string, id: string, action: string, after: Record<string, unknown>, reason?: string) {
  await audit.append({
    actorId: await actorId(email),
    actorType: "admin",
    action,
    targetType: "listing",
    targetId: id,
    before: { status: "pending" },
    after,
    reason,
    requestId: crypto.randomUUID(),
  });
}

/** pending -> active: the same fields normal publishing sets (slug, publish date, expiry, indexable). */
export async function approveListing(input: { id: string; roles: string[]; email: string }) {
  await connectDb();
  const listing = await pendingListing(input.id, input.roles);
  listing.status = "active";
  listing.seoNoindex = false;
  if (!listing.publishedAt) listing.publishedAt = new Date();
  listing.expiresAt = new Date(Date.now() + (await adLifetimeMs()));
  if (!listing.slug) listing.slug = await slugFor(listing.title, listing._id);
  await listing.save();
  const version = (await ListingVersion.countDocuments({ listingId: listing._id })) + 1;
  const snapshot = listing.toObject() as unknown as Record<string, unknown>;
  delete snapshot.__v;
  await ListingVersion.create({ listingId: listing._id, version, snapshot, actorId: (await actorId(input.email)) ?? listing.ownerId });
  await record(input.email, input.id, "listing.approve", { status: "active" });
  await revalidateListingPages(listing, (await Category.findById(listing.categoryId).select("slug").lean<{ slug?: string }>())?.slug);
  return { status: "active" as const };
}

type DecisionKind = "reject" | "remove";

export type DecisionResult = { status: "rejected" | "removed"; refunded: number; eventId: string; undoUntil: string | null };

const DECISION = {
  reject: { from: "pending", to: "rejected", action: "listing.reject", done: "Rejected an ad" },
  remove: { from: "active", to: "removed", action: "listing.remove", done: "Removed a live ad" },
} as const;

async function staffContext(email: string, roles: string[]): Promise<AdminCtx> {
  return { actorId: (await actorId(email)) as string, email, roles, requestId: crypto.randomUUID() };
}

async function decide(kind: DecisionKind, input: { id: string; roles: string[]; email: string; reason: string; refund: boolean }): Promise<DecisionResult> {
  await connectDb();
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 500) throw new ValidationError("Give a reason of 1 to 500 characters");
  const rule = DECISION[kind];
  if (!can(input.roles, "ads.decide")) throw new ForbiddenError("Only a moderator or admin can decide on ads");
  const listing = await Listing.findById(input.id);
  if (!listing) throw new NotFoundError("Ad not found");
  if (listing.status !== rule.from) throw new ConflictError(`This ad is ${listing.status}, not ${kind === "reject" ? "waiting for review" : "live"}`);
  const ctx = await staffContext(input.email, input.roles);
  const written = await adminWrite<{ refunded: number }>(ctx, {
    perm: "ads.decide",
    action: rule.action,
    target: { type: "listing", id: input.id, label: listing.title },
    reason,
    reasonRequired: true,
    undo: { kind: "listing.decision", windowKey: "decisions" },
    before: async () => ({ status: rule.from }),
    apply: async () => {
      listing.status = rule.to;
      await listing.save();
      const owner = listing.ownerId.toString();
      const give = input.refund && (await isPostingFeePaid(input.id));
      const refunded = give ? await refundPostingFee({ userId: owner, listingId: input.id, requestId: ctx.requestId }) : 0;
      if (kind === "remove") await revalidateListingPages(listing, (await Category.findById(listing.categoryId).select("slug").lean<{ slug?: string }>())?.slug);
      return {
        after: { status: rule.to, refundedCredits: refunded },
        result: { refunded },
        summary: refunded ? `${rule.done} and gave back ${refunded} credits` : rule.done,
        undoData: { id: input.id, from: rule.to, to: rule.from, refund: refunded > 0 ? { userId: owner, amount: refunded } : null },
      };
    },
  });
  return { status: rule.to, refunded: written.result.refunded, eventId: written.eventId, undoUntil: written.undoUntil };
}

/** pending -> rejected, with a reason kept in the audit log. A paid ad's fee is given back only when `refund` is true; the default is off. */
export async function rejectListing(input: { id: string; roles: string[]; email: string; reason: string; refund?: boolean }) {
  await connectDb();
  return decide("reject", { ...input, refund: input.refund === true });
}

/** active -> removed: a live ad comes down. The fee of a paid ad is given back only when `refund` is true. */
export async function removeLiveAd(input: { id: string; roles: string[]; email: string; reason: string; refund: boolean }) {
  await connectDb();
  return decide("remove", input);
}

/**
 * Undo of a decision that gave credits back: the same amount is taken back as a new fee charge, but only when the seller still has it.
 * Returns false when the credits were already spent; the ad is restored either way and nobody is charged a second time.
 */
export async function takeBackPostingFee(input: { userId: string; listingId: string; amount: number; requestId: string }): Promise<boolean> {
  await connectDb();
  const debits = await WalletEntry.countDocuments({ refType: FEE_REF, refId: new RegExp(`^${input.listingId}:`) });
  try {
    await debitWallet({ userId: input.userId, amount: input.amount, refType: FEE_REF, refId: `${input.listingId}:${debits}`, requestId: input.requestId, once: true });
    return true;
  } catch (error) {
    if (error instanceof PaymentRequiredError) return false;
    throw error;
  }
}
