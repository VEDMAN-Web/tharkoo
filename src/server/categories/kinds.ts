import { connectDb } from "@/lib/db";
import { DEFAULT_ICON_BY_KIND, isCategoryIconKey } from "@/lib/category-icons";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { hasAgeGate, PEOPLE_SLUGS } from "@/server/categories/kind";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http";
import { Category, CategoryKindDef } from "@/server/models";
import { CATEGORY_KINDS, type CategoryKindDoc } from "@/server/models/catalog";

import { PEOPLE_KEY, VIDEO_NEVER_FOR_PEOPLE, type KindView } from "@/lib/category-kinds";

export { PEOPLE_KEY, VIDEO_NEVER_FOR_PEOPLE };
export type { KindView };
const MAX_KIND_NAME = 40;
const BUILT_IN_NAMES: Record<string, string> = { goods: "Goods", property: "Property", vehicle: "Vehicle", job: "Job", service: "Service", people: "People" };

export type KindInput = Partial<Pick<KindView, "name" | "icon" | "maxPhotos" | "showPrice" | "showMap" | "showContact" | "videoTours">> & { key?: string };

/**
 * The locked rule: a people listing (a people slug, or any age 18+ field) behaves as People whatever Kind it was given,
 * and live video tours are never allowed on it. Read on every tour check, never from the Kind's own switch.
 */
export function isPeopleListing(row: { slug?: string; kind?: string; fields?: unknown } | null | undefined): boolean {
  if (!row) return false;
  return row.kind === PEOPLE_KEY || (PEOPLE_SLUGS as readonly string[]).includes(row.slug ?? "") || hasAgeGate(row.fields);
}

/** The kind key a category really uses: People for a people listing, else the one it was given. */
export function effectiveKind(row: { slug?: string; kind?: string; fields?: unknown } | null | undefined): string {
  return isPeopleListing(row) ? PEOPLE_KEY : (row?.kind ?? "");
}

const plain = (doc: CategoryKindDoc | null): KindView | null =>
  doc
    ? {
        key: doc.key,
        name: doc.name,
        icon: doc.icon ?? "",
        maxPhotos: doc.maxPhotos ?? null,
        showPrice: doc.showPrice !== false,
        showMap: doc.showMap !== false,
        showContact: doc.showContact !== false,
        videoTours: doc.key === PEOPLE_KEY ? false : doc.videoTours === true,
        builtIn: doc.builtIn === true,
        used: 0,
      }
    : null;

/** The six built-in kinds are written once, the first time anyone reads the list. Idempotent. */
export async function ensureKinds(): Promise<void> {
  await connectDb();
  if (await CategoryKindDef.exists({})) return;
  await CategoryKindDef.insertMany(
    CATEGORY_KINDS.map((key, order) => ({ key, name: BUILT_IN_NAMES[key], icon: DEFAULT_ICON_BY_KIND[key] ?? "", builtIn: true, order, videoTours: key !== PEOPLE_KEY })),
    { ordered: false },
  ).catch(() => undefined);
}

export async function listKinds(): Promise<KindView[]> {
  await connectDb();
  await ensureKinds();
  const rows = await CategoryKindDef.find({ removed: { $ne: true } }).sort({ order: 1, name: 1 }).lean<CategoryKindDoc[]>();
  const counts = await Category.aggregate<{ _id: string; n: number }>([{ $match: { deletedAt: null } }, { $group: { _id: "$kind", n: { $sum: 1 } } }]);
  const used = new Map(counts.map((row) => [row._id, row.n]));
  return rows.map((row) => ({ ...(plain(row) as KindView), used: used.get(row.key) ?? 0 }));
}

/** A category must use a kind that exists. */
export async function requireKind(value: unknown): Promise<string> {
  const key = typeof value === "string" ? value.trim() : "";
  if (!key) throw new ValidationError("Choose a kind to save.");
  await connectDb();
  await ensureKinds();
  if (!(await CategoryKindDef.exists({ key, removed: { $ne: true } }))) throw new ValidationError("Choose a kind from the list.");
  return key;
}

function cleanName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > MAX_KIND_NAME) throw new ValidationError(`A kind name has 2 to ${MAX_KIND_NAME} characters.`);
  return name;
}

function cleanKey(value: unknown, name: string): string {
  const source = typeof value === "string" && value.trim() ? value : name;
  const key = source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  if (!/^[a-z][a-z0-9-]{1,29}$/.test(key)) throw new ValidationError("The key needs 2 to 30 letters, digits or dashes, starting with a letter.");
  return key;
}

function cleanMaxPhotos(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new ValidationError("Max photos is a whole number from 1 to 30.");
  return count;
}

function cleanIcon(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (!isCategoryIconKey(value)) throw new ValidationError("Choose an icon from the list.");
  return value;
}

const FIELDS = ["name", "icon", "maxPhotos", "showPrice", "showMap", "showContact", "videoTours", "removed"] as const;
const pick = (doc: Record<string, unknown> | null) => Object.fromEntries(FIELDS.map((field) => [field, doc?.[field] ?? null]));

type Written = { key: string };

async function write(ctx: AdminCtx, action: string, key: string, label: string, summary: string, change: (current: CategoryKindDoc | null) => Record<string, unknown>) {
  const before = async () => pick(await CategoryKindDef.findOne({ key }).lean<Record<string, unknown> | null>());
  return adminWrite<Written>(ctx, {
    perm: "catalogue.edit",
    action,
    target: { type: "category_kind", id: key, label },
    texts: [label],
    undo: { kind: "record.restore", windowKey: "edits" },
    before,
    apply: async () => {
      const current = await CategoryKindDef.findOne({ key }).lean<CategoryKindDoc | null>();
      const restore = pick(current as unknown as Record<string, unknown> | null);
      const set = change(current);
      await CategoryKindDef.updateOne({ key }, { $set: set }, { upsert: true });
      const now = await CategoryKindDef.findOne({ key }).lean<CategoryKindDoc & { _id: unknown }>();
      return {
        after: pick(now as unknown as Record<string, unknown>),
        result: { key },
        summary,
        undoData: { model: "CategoryKindDef", id: String(now?._id), restore: current ? restore : { removed: true }, unset: [], expect: pick(now as unknown as Record<string, unknown>) },
      };
    },
  });
}

export async function createKind(ctx: AdminCtx, input: KindInput) {
  await connectDb();
  await ensureKinds();
  const name = cleanName(input.name);
  const key = cleanKey(input.key, name);
  if (await CategoryKindDef.exists({ key })) throw new ConflictError("A kind with that key already exists (or was removed: undo it from History & undo).");
  const order = (await CategoryKindDef.countDocuments({})) + 1;
  const done = await write(ctx, "category_kind.create", key, name, `Added the kind ${name}`, () => ({
    key,
    name,
    icon: cleanIcon(input.icon),
    maxPhotos: cleanMaxPhotos(input.maxPhotos),
    showPrice: input.showPrice !== false,
    showMap: input.showMap !== false,
    showContact: input.showContact !== false,
    videoTours: input.videoTours === true,
    builtIn: false,
    order,
    removed: false,
  }));
  return { key, eventId: done.eventId };
}

export async function updateKind(ctx: AdminCtx, key: string, input: KindInput) {
  await connectDb();
  await ensureKinds();
  const current = await CategoryKindDef.findOne({ key, removed: { $ne: true } }).lean<CategoryKindDoc | null>();
  if (!current) throw new NotFoundError("Kind not found");
  if (key === PEOPLE_KEY && input.videoTours === true) throw new ValidationError(VIDEO_NEVER_FOR_PEOPLE);
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = cleanName(input.name);
  if (input.icon !== undefined) set.icon = cleanIcon(input.icon);
  if (input.maxPhotos !== undefined) set.maxPhotos = cleanMaxPhotos(input.maxPhotos);
  for (const flag of ["showPrice", "showMap", "showContact"] as const) if (input[flag] !== undefined) set[flag] = Boolean(input[flag]);
  if (input.videoTours !== undefined) set.videoTours = key === PEOPLE_KEY ? false : Boolean(input.videoTours);
  const done = await write(ctx, "category_kind.update", key, String(set.name ?? current.name), `Changed the kind ${current.name}`, () => set);
  return { key, eventId: done.eventId };
}

/** A kind that categories use is never removed. The kind People is built in and stays. */
export async function removeKind(ctx: AdminCtx, key: string) {
  await connectDb();
  await ensureKinds();
  const current = await CategoryKindDef.findOne({ key, removed: { $ne: true } }).lean<CategoryKindDoc | null>();
  if (!current) throw new NotFoundError("Kind not found");
  if (key === PEOPLE_KEY) throw new ValidationError("The kind People is built in and cannot be removed.");
  const used = await Category.countDocuments({ kind: key, deletedAt: null });
  if (used > 0) throw new ValidationError(`${used} categor${used === 1 ? "y uses" : "ies use"} this kind. Give them another kind first.`);
  const done = await write(ctx, "category_kind.remove", key, current.name, `Removed the kind ${current.name}`, () => ({ removed: true }));
  return { key, eventId: done.eventId };
}

/** What the ad page shows for a kind: price, map and contact buttons. A kind that does not exist shows everything. */
export async function kindFeatures(key: string | undefined): Promise<{ price: boolean; map: boolean; contact: boolean }> {
  if (!key) return { price: true, map: true, contact: true };
  await connectDb();
  await ensureKinds();
  const row = await CategoryKindDef.findOne({ key, removed: { $ne: true } }).lean<CategoryKindDoc | null>();
  return { price: row?.showPrice !== false, map: row?.showMap !== false, contact: row?.showContact !== false };
}

/** The photo limit for a category: its own number, else the number of its kind, else null (the default of 10). */
export async function kindMaxPhotos(key: string | undefined): Promise<number | null> {
  if (!key) return null;
  await connectDb();
  await ensureKinds();
  const row = await CategoryKindDef.findOne({ key, removed: { $ne: true } }).select("maxPhotos").lean<{ maxPhotos?: number | null } | null>();
  return row?.maxPhotos ?? null;
}

/** Live video tours may run only for a kind that allows them, and never for a people listing. */
export async function kindAllowsVideo(row: { slug?: string; kind?: string; fields?: unknown }): Promise<boolean> {
  if (isPeopleListing(row)) return false;
  await connectDb();
  await ensureKinds();
  const kind = await CategoryKindDef.findOne({ key: row.kind, removed: { $ne: true } }).select("videoTours").lean<{ videoTours?: boolean } | null>();
  return kind?.videoTours === true;
}
