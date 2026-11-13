import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { validateSlug } from "@/lib/urls";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { Listing, Location, User, type LocationLevel } from "@/server/models";
import { textDenied } from "@/server/shared/policy";
import { renameLocation } from "@/server/urls/service";

const audit = new AuditRepository();
const MANAGED: LocationLevel[] = ["country", "state", "city"];
const PARENT_OF: Record<string, LocationLevel | null> = { country: null, state: "country", city: "state" };
const MAX_NAME = 80;

export interface PlaceInput {
  type?: string;
  parentId?: string | null;
  name?: string;
  slug?: string;
  countryCode?: string;
  order?: number;
  enabled?: boolean;
}

interface Actor {
  email: string;
  roles: string[];
}

function requireAdmin(actor: Actor) {
  if (!isAdminRole(actor.roles)) throw new ForbiddenError("Only an admin can edit places");
}

function cleanName(value: unknown) {
  const name = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!name) throw new ValidationError("Name is required");
  if (name.length > MAX_NAME) throw new ValidationError(`Name must be ${MAX_NAME} characters or fewer`);
  if (textDenied(name).denied) throw new ValidationError("That name contains a term that is not allowed on Tharkoo");
  return name;
}

function cleanCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();
  if (code && !/^[A-Z]{2}$/.test(code)) throw new ValidationError("Flag code must be two letters, like IN");
  return code;
}

function cleanOrder(value: unknown) {
  const order = Number(value ?? 0);
  if (!Number.isFinite(order) || order < -9999 || order > 9999) throw new ValidationError("Order must be a number between -9999 and 9999");
  return Math.trunc(order);
}

async function record(actor: Actor, action: string, id: string, before: unknown, after: unknown) {
  const user = actor.email ? await User.findOne({ email: actor.email }).select("_id") : null;
  await audit.append({
    actorId: user?._id?.toString() ?? null,
    actorType: "admin",
    action,
    targetType: "location",
    targetId: id,
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    requestId: randomUUID(),
  });
}

export async function createPlace(actor: Actor, input: PlaceInput) {
  requireAdmin(actor);
  await connectDb();
  const type = String(input.type) as LocationLevel;
  if (!MANAGED.includes(type)) throw new ValidationError("Type must be country, state or city");
  const name = cleanName(input.name);
  const parsed = validateSlug(input.slug || name);
  if (!parsed.ok) throw new ValidationError(parsed.message);
  let parentId: Types.ObjectId | null = null;
  const parentType = PARENT_OF[type];
  if (parentType) {
    if (!input.parentId || !Types.ObjectId.isValid(input.parentId)) throw new ValidationError(`Pick the ${parentType} this ${type} belongs to`);
    const parent = await Location.findOne({ _id: input.parentId, type: parentType }).select("_id").lean();
    if (!parent) throw new ValidationError(`Pick the ${parentType} this ${type} belongs to`);
    parentId = new Types.ObjectId(input.parentId);
  }
  const code = cleanCode(input.countryCode);
  if (type === "country" && !code) throw new ValidationError("Flag code is required for a country, like IN");
  const clash = await Location.findOne({ parentId, type, slug: parsed.slug }).select("_id").lean();
  if (clash) throw new ValidationError("That slug is already used here");
  const doc = await Location.create({
    type,
    slug: parsed.slug,
    name,
    parentId,
    order: cleanOrder(input.order),
    enabled: input.enabled !== false,
    countryCode: type === "country" ? code : undefined,
  });
  await record(actor, "location.create", String(doc._id), null, { type, slug: parsed.slug, name });
  await refreshPublicCache();
  return { id: String(doc._id) };
}

export async function updatePlace(actor: Actor, id: string, input: PlaceInput) {
  requireAdmin(actor);
  await connectDb();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Place not found");
  const doc = await Location.findById(id);
  if (!doc) throw new NotFoundError("Place not found");
  const before = { slug: doc.slug, name: doc.name, order: doc.order, enabled: doc.enabled, countryCode: doc.countryCode };
  if (input.name !== undefined) doc.name = cleanName(input.name);
  if (input.order !== undefined) doc.order = cleanOrder(input.order);
  if (input.enabled !== undefined) doc.enabled = Boolean(input.enabled);
  if (input.countryCode !== undefined && doc.type === "country") doc.countryCode = cleanCode(input.countryCode);
  await doc.save();
  // A slug change keeps the old address working through redirects.
  if (input.slug !== undefined && input.slug !== doc.slug) await renameLocation(id, input.slug);
  const after = await Location.findById(id).lean();
  await record(actor, "location.update", id, before, {
    slug: after?.slug,
    name: after?.name,
    order: after?.order,
    enabled: after?.enabled,
    countryCode: after?.countryCode,
  });
  await refreshPublicCache();
  return { ok: true as const };
}

/** Removing a place that still has children or ads is blocked: hide it instead. */
export async function deletePlace(actor: Actor, id: string) {
  requireAdmin(actor);
  await connectDb();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Place not found");
  const doc = await Location.findById(id).lean();
  if (!doc) throw new NotFoundError("Place not found");
  if (await Location.exists({ parentId: doc._id })) {
    throw new ValidationError("This place has places inside it. Remove those first, or hide it.");
  }
  const field = doc.type === "city" ? "cityId" : doc.type === "state" ? "stateId" : null;
  if (field && (await Listing.exists({ [field]: doc._id }))) {
    throw new ValidationError("This place has ads. Hide it instead of removing it.");
  }
  await Location.deleteOne({ _id: doc._id });
  await record(actor, "location.delete", id, { type: doc.type, slug: doc.slug, name: doc.name }, null);
  await refreshPublicCache();
  return { ok: true as const };
}
