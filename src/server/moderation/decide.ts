import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { canSee } from "@/components/admin/nav";
import { AuditRepository } from "@/server/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { adLifetimeMs } from "@/server/listings/lifetime";
import { revalidateListingPages } from "@/server/listings/revalidate";
import { Category, Listing, ListingVersion, User } from "@/server/models";
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
  if (!canSee(roles, "moderator")) throw new ForbiddenError("Only a moderator or admin can decide on ads");
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

/** pending -> rejected, with a reason that is kept in the audit log. */
export async function rejectListing(input: { id: string; roles: string[]; email: string; reason: string }) {
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 500) throw new ValidationError("Give a reason of 1 to 500 characters");
  const listing = await pendingListing(input.id, input.roles);
  listing.status = "rejected";
  await listing.save();
  await record(input.email, input.id, "listing.reject", { status: "rejected" }, reason);
  return { status: "rejected" as const };
}
