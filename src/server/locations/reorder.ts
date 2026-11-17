import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { NotFoundError, ValidationError } from "@/server/http";
import { Location } from "@/server/models";

/**
 * H8.56: drag to reorder places. The places of one kind (cities, states or countries) are listed by their Order number, then by name.
 * The screen sends the places it moved, in the new order. They swap among the spots they already held in the full list of that kind,
 * and the whole kind is numbered 0, 1, 2 ... again, so equal numbers (every place starts at 0) never make the order unclear.
 */

const MAX_MOVED = 200;
const KINDS = ["city", "state", "country"];

export async function reorderPlaces(ctx: AdminCtx, ids: string[]): Promise<{ moved: number }> {
  await connectDb();
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > MAX_MOVED || new Set(ids).size !== ids.length || !ids.every((id) => Types.ObjectId.isValid(id))) throw new ValidationError("Nothing to reorder.");
  const picked = await Location.find({ _id: { $in: ids } }).select("type name").lean<{ _id: Types.ObjectId; type: string; name: string }[]>();
  if (picked.length !== ids.length) throw new NotFoundError("One of the places no longer exists.");
  const type = picked[0].type;
  if (!KINDS.includes(type) || picked.some((row) => row.type !== type)) throw new ValidationError("Only places of the same kind can be reordered together.");

  const all = await Location.find({ type: type as "city" | "state" | "country" }).select("order").sort({ order: 1, name: 1, _id: 1 }).collation({ locale: "en", strength: 2 }).lean<{ _id: Types.ObjectId; order?: number }[]>();
  const spots = all.map((row, index) => ({ id: String(row._id), index })).filter((row) => ids.includes(row.id)).map((row) => row.index);
  const next = all.map((row) => String(row._id));
  spots.forEach((spot, position) => {
    next[spot] = ids[position];
  });
  const wasOf = new Map(all.map((row) => [String(row._id), row.order ?? 0]));
  const changed = next.map((id, index) => ({ id, index, was: wasOf.get(id) ?? 0 })).filter((row) => row.was !== row.index);
  const label = `${picked.length} ${type === "city" ? "cities" : `${type}s`}`;

  await adminWrite(ctx, {
    perm: "catalogue.edit",
    action: "location.reorder",
    target: { type: "Location", id: ids[0], label },
    before: async () => ({ orders: Object.fromEntries(changed.slice(0, 50).map((row) => [row.id, row.was])) }),
    apply: async () => {
      if (changed.length > 0) await Location.bulkWrite(changed.map((row) => ({ updateOne: { filter: { _id: new Types.ObjectId(row.id) }, update: { $set: { order: row.index } } } })));
      return { after: { orders: Object.fromEntries(changed.slice(0, 50).map((row) => [row.id, row.index])) }, result: null, summary: `Changed the order of ${label}` };
    },
  });
  await refreshPublicCache();
  return { moved: changed.length };
}
