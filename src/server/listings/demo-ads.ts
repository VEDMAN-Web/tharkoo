import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { Listing, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";

const audit = new AuditRepository();

export const DEMO_SLUG = /^demo-[0-9]{1,6}$/;
export function isDemoAd(ownerEmail: string | undefined, slug: string | undefined): boolean {
  return ownerEmail === SEED_USER_EMAIL && DEMO_SLUG.test(slug ?? "");
}

export const DEMO_END_STATUS = "expired";
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
  const result = await Listing.updateMany({ ...filter, _id: { $in: ids }, status: "active" }, { $set: { status: DEMO_END_STATUS } });
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "listing.demo.end",
    targetType: "listing",
    targetId: "demo-ads",
    requestId: input.requestId,
    before: { active: active.length },
    after: { ended: result.modifiedCount, status: DEMO_END_STATUS, sample: active.slice(0, SAMPLE).map((row) => row.slug ?? String(row._id)) },
  });
  await refreshPublicCache();
  return { ended: result.modifiedCount };
}
