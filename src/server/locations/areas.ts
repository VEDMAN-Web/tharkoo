import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { validateSlug } from "@/lib/urls";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http";
import { Listing, Location, type LocationLevel } from "@/server/models";

/**
 * H8.52: the areas of a city. A DISTRICT belongs to a city and a LOCALITY belongs to a district. Staff can add one, rename it,
 * hide it, and remove it when no ad uses it. Every change is one audited write; a rename or a hide can be undone.
 */

const MAX_NAME = 80;
type Doc = Record<string, unknown>;

function cleanName(value: unknown): string {
  const name = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!name) throw new ValidationError("Write a name.");
  if (name.length > MAX_NAME) throw new ValidationError(`Keep the name to ${MAX_NAME} characters.`);
  return name;
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function areaOf(id: string) {
  await connectDb();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Area not found");
  const doc = plain(await Location.findOne({ _id: id, type: { $in: ["district", "locality"] } }).lean<Doc | null>());
  if (!doc) throw new NotFoundError("Area not found");
  return doc;
}

/** Adds a district to a city, or a locality to a district. The web address comes from the name unless one is given. */
export async function createArea(ctx: AdminCtx, input: { parentId: string; name: string; slug?: string }): Promise<{ id: string; eventId: string }> {
  await connectDb();
  if (!Types.ObjectId.isValid(input.parentId)) throw new ValidationError("Pick the city or district it belongs to.");
  const parent = await Location.findById(input.parentId).select("type name").lean<{ type: LocationLevel; name: string } | null>();
  const type = parent?.type === "city" ? "district" : parent?.type === "district" ? "locality" : null;
  if (!parent || !type) throw new ValidationError("An area goes inside a city (a district) or inside a district (a locality).");
  const name = cleanName(input.name);
  const parsed = validateSlug(input.slug?.trim() || name);
  if (!parsed.ok) throw new ValidationError(parsed.message);
  if (await Location.exists({ parentId: input.parentId, type, slug: parsed.slug })) throw new ValidationError("That web address is already used here.");
  const written = await adminWrite<{ id: string }>(ctx, {
    perm: "catalogue.edit",
    action: "area.create",
    target: { type: "Location", id: input.parentId, label: `${name} in ${parent.name}` },
    texts: [name],
    before: async () => null,
    apply: async () => {
      const created = await Location.create({ type, slug: parsed.slug, name, parentId: input.parentId, enabled: true, order: 0 });
      return { after: { type, slug: parsed.slug, name }, result: { id: String(created._id) }, summary: `Added the ${type} ${name} to ${parent.name}` };
    },
  });
  await refreshPublicCache();
  return { id: written.result.id, eventId: written.eventId };
}

/** Renames an area or hides or shows it. The web address stays. Undo puts the old name and visibility back. */
export async function updateArea(ctx: AdminCtx, id: string, input: { name?: string; enabled?: boolean }): Promise<{ eventId: string; name: string }> {
  await connectDb();
  const existing = await areaOf(id);
  const set: Doc = {};
  if (input.name !== undefined) set.name = cleanName(input.name);
  if (input.enabled !== undefined) set.enabled = Boolean(input.enabled);
  const keys = Object.keys(set);
  if (keys.length === 0) throw new ValidationError("Nothing to change.");
  const label = String(existing.name ?? existing.slug);
  const was = Object.fromEntries(keys.map((key) => [key, existing[key]]).filter(([, value]) => value !== undefined));
  const written = await adminWrite<{ name: string }>(ctx, {
    perm: "catalogue.edit",
    action: set.enabled === undefined ? "area.rename" : set.name === undefined ? (set.enabled ? "area.show" : "area.hide") : "area.update",
    target: { type: "Location", id, label },
    texts: [set.name],
    undo: { kind: "record.restore", windowKey: "edits" },
    before: async () => was,
    apply: async () => {
      await Location.updateOne({ _id: id }, { $set: set });
      const now = plain(await Location.findById(id).lean<Doc | null>()) ?? {};
      const after = Object.fromEntries(keys.map((key) => [key, now[key]]));
      return {
        after,
        result: { name: String(now.name ?? label) },
        summary: set.enabled === undefined ? `Renamed ${label} to ${String(set.name)}` : `${set.enabled ? "Showed" : "Hid"} ${label}`,
        undoData: { model: "Location", id, restore: was, unset: keys.filter((key) => existing[key] === undefined), expect: after },
      };
    },
  });
  await refreshPublicCache();
  return { eventId: written.eventId, name: written.result.name };
}

/** Removes an area that has no places inside it and no ads. Otherwise it says to hide it instead. */
export async function removeArea(ctx: AdminCtx, id: string): Promise<{ name: string }> {
  await connectDb();
  const existing = await areaOf(id);
  const label = String(existing.name ?? existing.slug);
  if (await Location.exists({ parentId: id })) throw new ConflictError(`${label} has places inside it. Remove those first, or hide it.`);
  if (existing.type === "district" && (await Listing.exists({ districtId: id }))) throw new ConflictError(`${label} has ads. Hide it instead of removing it.`);
  await adminWrite<null>(ctx, {
    perm: "catalogue.edit",
    action: "area.remove",
    target: { type: "Location", id, label },
    before: async () => ({ type: existing.type, slug: existing.slug, name: existing.name }),
    apply: async () => {
      await Location.deleteOne({ _id: id });
      return { after: null, result: null, summary: `Removed the ${String(existing.type)} ${label}` };
    },
  });
  await refreshPublicCache();
  return { name: label };
}
