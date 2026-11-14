import type { Types } from "mongoose";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError } from "@/server/http";
import { adLifetimeMs } from "@/server/listings/lifetime";
import { Listing, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";

const audit = new AuditRepository();

/**
 * Renews the demo ads so the staging site keeps showing live listings (H6.7).
 * Superadmin only, and only while SITE_NOINDEX=true. Real ads, owned by real users, are never touched.
 */
export async function refreshDemoAds(input: { actorId: string; roles: readonly string[]; requestId: string }) {
  if (!input.roles.includes("superadmin")) throw new ForbiddenError("Only a superadmin refreshes demo ads");
  if (process.env.SITE_NOINDEX !== "true") throw new ForbiddenError("Demo ads can only be refreshed on the staging site");
  const seed = await User.findOne({ email: SEED_USER_EMAIL }).select("_id").lean<{ _id: Types.ObjectId }>();
  if (!seed) return { refreshed: 0 };
  const lifetime = await adLifetimeMs();
  const result = await Listing.updateMany(
    { ownerId: seed._id, status: { $in: ["active", "expired"] } },
    { $set: { status: "active", expiresAt: new Date(Date.now() + lifetime) } },
  );
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "seed.demo_ads.refresh",
    targetType: "listing",
    targetId: "demo",
    requestId: input.requestId,
    after: { refreshed: result.modifiedCount, lifetimeMs: lifetime },
  });
  return { refreshed: result.modifiedCount };
}
