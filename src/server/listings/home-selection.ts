import { z } from "zod";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { Listing } from "@/server/models/listing";

const audit = new AuditRepository();
const MAX_ORDER = 9999;
const RECENT_ROWS = 50;

export const homeSelectionSchema = z
  .object({
    show: z.boolean(),
    order: z.number().int().min(0).max(MAX_ORDER),
  })
  .strict();

export type HomeSelectionRow = { id: string; title: string; status: string; show: boolean; order: number };

export async function homeSelectionRows(): Promise<HomeSelectionRow[]> {
  await connectDb();
  const chosen = await Listing.find({ homeShow: true })
    .sort({ homeOrder: 1, updatedAt: -1 })
    .select("title status homeShow homeOrder")
    .lean<{ _id: Types.ObjectId; title?: string; status?: string; homeShow?: boolean; homeOrder?: number }[]>();
  const recent = await Listing.find({ homeShow: { $ne: true } })
    .sort({ updatedAt: -1 })
    .limit(RECENT_ROWS)
    .select("title status homeShow homeOrder")
    .lean<{ _id: Types.ObjectId; title?: string; status?: string; homeShow?: boolean; homeOrder?: number }[]>();
  return [...chosen, ...recent].map((row) => ({
    id: String(row._id),
    title: row.title || "Untitled",
    status: row.status || "",
    show: row.homeShow === true,
    order: row.homeOrder ?? 0,
  }));
}

export async function setHomeSelection(input: {
  listingId: string;
  show: boolean;
  order: number;
  actor: { id: string; roles: string[] };
  requestId: string;
}) {
  if (!isAdminRole(input.actor.roles)) throw new ForbiddenError("Only an admin can choose the ads on Home");
  const parsed = homeSelectionSchema.safeParse({ show: input.show, order: input.order });
  if (!parsed.success) throw new ValidationError("Enter an order from 0 to 9999");
  if (!Types.ObjectId.isValid(input.listingId)) throw new NotFoundError("Ad not found");
  await connectDb();
  const before = await Listing.findById(input.listingId).select("homeShow homeOrder").lean<{ homeShow?: boolean; homeOrder?: number } | null>();
  if (!before) throw new NotFoundError("Ad not found");
  await Listing.updateOne({ _id: input.listingId }, { $set: { homeShow: parsed.data.show, homeOrder: parsed.data.order } }, { timestamps: false });
  await refreshPublicCache();
  await audit.append({
    actorId: input.actor.id,
    actorType: "admin",
    action: "ad.home.update",
    targetType: "listing",
    targetId: input.listingId,
    requestId: input.requestId,
    before: { show: before.homeShow === true, order: before.homeOrder ?? 0 },
    after: { show: parsed.data.show, order: parsed.data.order },
  });
  return { show: parsed.data.show, order: parsed.data.order };
}
