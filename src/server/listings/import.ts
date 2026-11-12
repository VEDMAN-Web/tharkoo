import { type Types } from "mongoose";
import { z } from "zod";
import { siteUrl } from "@/lib/utils";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, HttpError, NotFoundError, ValidationError } from "@/server/http";
import { parseCsv } from "@/server/listings/csv";
import { createDraft, patchListing } from "@/server/listings/service";
import {
  BannedWord,
  Category,
  Listing,
  ListingVersion,
  Location,
  MediaAsset,
  User,
  type CategoryDoc,
  type ListingDoc,
} from "@/server/models";
import { photoLimit } from "@/server/media/config";
import { parseListingAttributes, type FieldDefinition } from "@/server/shared/fields";
import { textDenied } from "@/server/shared/policy";
import { evaluatePublishGate } from "@/server/shared/publish-gate";
import { toSlug } from "@/server/shared/slug";
import { assertVerified } from "@/server/verification/service";

export const MAX_IMPORT_ROWS = 200;
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const TITLE_MAX = 140;
const DESCRIPTION_MAX = 5000;
const REQUIRED_COLUMNS = ["category", "city", "title", "description"] as const;
const PHOTO_COLUMN = "photos";
const PHOTO_ALIASES = new Set(["photos", "photo_urls", "photo_url", "photo"]);
const BASE_COLUMNS = new Set<string>([...REQUIRED_COLUMNS, "district", PHOTO_COLUMN]);
const CLOUDINARY_HOST = "res.cloudinary.com";

const audit = new AuditRepository();

export type ImportStatus = "pending" | "active";

export interface ImportActor {
  id: string;
  roles: string[];
}

export interface ImportRowReport {
  line: number;
  title: string;
  ok: boolean;
  errors: string[];
}

export interface DryRunReport {
  partner: { id: string; email: string; displayName: string };
  total: number;
  okCount: number;
  rows: ImportRowReport[];
}

export interface ImportReport extends DryRunReport {
  status: ImportStatus;
  imported: number;
  failed: number;
}

interface RowInput {
  categoryId: string;
  stateId?: string;
  cityId: string;
  districtId?: string;
  title: string;
  description: string;
  attributes: Record<string, unknown>;
  mediaIds: string[];
}

interface Plan {
  report: ImportRowReport;
  input?: RowInput;
}

interface Prepared {
  partner: { id: string; email: string; displayName: string; doc: UserRow };
  plans: Plan[];
}

type UserRow = {
  dateOfBirth: Date;
  attestedAdultAt?: Date;
  verificationStatus: "unsubmitted" | "pending_review" | "approved" | "rejected";
  status: "active" | "suspended" | "deleted";
};

type PlaceRow = { _id: Types.ObjectId; parentId?: Types.ObjectId | null; type: string };

interface Lookups {
  banned: string[];
  categories: Map<string, (CategoryDoc & { _id: Types.ObjectId }) | null>;
  cities: Map<string, PlaceRow | null>;
  districts: Map<string, PlaceRow | null>;
  taken: Set<string>;
}

function assertStaff(actor: ImportActor) {
  if (!actor.roles.some((role) => role === "admin" || role === "superadmin")) throw new ForbiddenError("Not allowed");
}

function normaliseHeader(raw: string) {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return PHOTO_ALIASES.has(key) ? PHOTO_COLUMN : key;
}

function clean(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
}

function readTable(csv: string) {
  if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) throw new ValidationError("The file is too large (2 MB at most)");
  let table: string[][];
  try {
    table = parseCsv(csv);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : "The file is not a valid CSV");
  }
  if (table.length === 0) throw new ValidationError("The file is empty");
  const headers = table[0].map(normaliseHeader);
  const missing = REQUIRED_COLUMNS.filter((name) => !headers.includes(name));
  if (missing.length) throw new ValidationError(`Missing columns: ${missing.join(", ")}`);
  if (new Set(headers).size !== headers.length) throw new ValidationError("Two columns have the same name");
  const body = table.slice(1);
  if (body.length === 0) throw new ValidationError("The file has a header row and no listings");
  if (body.length > MAX_IMPORT_ROWS) {
    throw new ValidationError(`Too many rows: ${body.length}. The limit is ${MAX_IMPORT_ROWS} per file`);
  }
  return { headers, body };
}

async function findPartner(email: string) {
  await connectDb();
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) throw new NotFoundError("No account with that email");
  if (user.status !== "active") throw new ForbiddenError("That account is not active");
  const id = user._id.toString();
  await assertVerified(id);
  return { id, email: user.email, displayName: user.displayName, doc: user as UserRow };
}

function fieldDefs(category: CategoryDoc): FieldDefinition[] {
  return (category.fields ?? []).map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: Boolean(field.required),
    options: field.options ?? [],
    min: field.min,
    max: field.max,
    unit: field.unit ?? "",
    order: field.order ?? 0,
    enabled: field.enabled !== false,
    filterable: field.filterable,
    shownOnCard: field.shownOnCard,
    placeholder: field.placeholder ?? "",
    optionLabels: field.optionLabels,
  }));
}

function toValue(def: FieldDefinition | undefined, raw: string): unknown {
  switch (def?.type) {
    case "number":
      return Number(raw.replace(/,/g, ""));
    case "boolean":
    case "bool":
      if (/^(true|yes|1)$/i.test(raw)) return true;
      if (/^(false|no|0)$/i.test(raw)) return false;
      return raw;
    case "multiselect":
      return raw.split("|").map((part) => part.trim()).filter(Boolean);
    case "range": {
      const match = /^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/.exec(raw);
      return match ? { min: Number(match[1]), max: Number(match[2]) } : raw;
    }
    default:
      return raw;
  }
}

function attributesFor(category: CategoryDoc, cells: Record<string, string>, errors: string[]) {
  const defs = fieldDefs(category);
  const byKey = new Map(defs.map((def) => [def.key, def]));
  const raw: Record<string, unknown> = {};
  for (const [key, cell] of Object.entries(cells)) {
    if (!BASE_COLUMNS.has(key) && cell) raw[key] = toValue(byKey.get(key), cell);
  }
  const reported = new Set<string>();
  for (const def of defs) {
    if (def.enabled && def.required && raw[def.key] === undefined) {
      errors.push(`Required field "${def.label}" (${def.key}) is empty`);
      reported.add(def.key);
    }
  }
  try {
    return parseListingAttributes(defs, raw);
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    for (const issue of error.issues) {
      if (issue.code === "unrecognized_keys") {
        errors.push(`This category has no field "${issue.keys.join(", ")}"`);
        continue;
      }
      const key = String(issue.path[0] ?? "");
      if (!reported.has(key)) errors.push(`Field "${byKey.get(key)?.label ?? key}": ${issue.message}`);
    }
    return null;
  }
}

function photoCandidates(value: string): string[] | null {
  if (value.startsWith("/") && !value.startsWith("//")) return [value];
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.host === new URL(siteUrl()).host) return [decodeURIComponent(url.pathname)];
  if (url.host !== CLOUDINARY_HOST) return null;
  const parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);
  const keys: string[] = [];
  for (let start = 0; start < parts.length; start += 1) {
    const joined = parts.slice(start).join("/");
    keys.push(joined, joined.replace(/\.[a-z0-9]+$/i, ""));
  }
  return keys;
}

async function resolvePhotos(partnerId: string, cell: string, errors: string[]) {
  const urls = cell.split(/[|;\s]+/).map((part) => part.trim()).filter(Boolean);
  if (urls.length === 0) return [];
  const limit = photoLimit(false);
  if (urls.length > limit) errors.push(`Too many photos: ${urls.length}. The limit is ${limit}`);
  const ids: string[] = [];
  for (const url of urls.slice(0, limit)) {
    const candidates = photoCandidates(url);
    if (!candidates) {
      errors.push(`Photo URL is not from our own uploads: ${url.slice(0, 80)}`);
      continue;
    }
    const asset = await MediaAsset.findOne({
      ownerId: partnerId,
      kind: "image",
      status: "cleared",
      objectKey: { $in: candidates },
    }).select("_id");
    if (!asset) errors.push(`Photo is not among the partner's cleared uploads: ${url.slice(0, 80)}`);
    else if (ids.includes(asset._id.toString())) errors.push(`The same photo is listed twice: ${url.slice(0, 80)}`);
    else ids.push(asset._id.toString());
  }
  return ids;
}

function bannedHit(text: string, banned: string[]) {
  const haystack = text.toLowerCase();
  return textDenied(text).denied || banned.some((needle) => haystack.includes(needle));
}

function textErrors(input: { title: string; description: string; attributes: Record<string, unknown> }, banned: string[]) {
  const checks: Array<[string, string]> = [
    ["title", input.title],
    ["description", input.description],
    ...Object.entries(input.attributes)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => [key, value] as [string, string]),
  ];
  return checks.filter(([, text]) => bannedHit(text, banned)).map(([name]) => `The ${name} contains a word that is not allowed`);
}

async function lookupCategory(lookups: Lookups, slug: string) {
  if (!lookups.categories.has(slug)) {
    const row = await Category.findOne({ slug, deletedAt: null });
    lookups.categories.set(slug, row as (CategoryDoc & { _id: Types.ObjectId }) | null);
  }
  return lookups.categories.get(slug) ?? null;
}

async function lookupPlace(lookups: Lookups, cell: Record<string, string>, errors: string[]) {
  const citySlug = cell.city.toLowerCase();
  if (!lookups.cities.has(citySlug)) {
    lookups.cities.set(citySlug, (await Location.findOne({ type: "city", slug: citySlug, enabled: { $ne: false } })) as PlaceRow | null);
  }
  const city = lookups.cities.get(citySlug) ?? null;
  if (!city) {
    errors.push(`Unknown city "${cell.city}" (use the city slug, for example surat)`);
    return null;
  }
  const state = city.parentId ? await Location.findById(city.parentId).select("type") : null;
  const stateId = state?.type === "state" ? state._id.toString() : undefined;
  if (!cell.district) return { cityId: city._id.toString(), stateId };
  const districtSlug = cell.district.toLowerCase();
  const key = `${city._id.toString()}:${districtSlug}`;
  if (!lookups.districts.has(key)) {
    lookups.districts.set(key, (await Location.findOne({ type: "district", slug: districtSlug, parentId: city._id, enabled: { $ne: false } })) as PlaceRow | null);
  }
  const district = lookups.districts.get(key);
  if (!district) {
    errors.push(`Unknown district "${cell.district}" in ${cell.city}`);
    return null;
  }
  return { cityId: city._id.toString(), stateId, districtId: district._id.toString() };
}

async function planRow(
  line: number,
  cells: Record<string, string>,
  partner: Prepared["partner"],
  lookups: Lookups,
): Promise<Plan> {
  const errors: string[] = [];
  const title = cells.title;
  for (const name of REQUIRED_COLUMNS) {
    if (!cells[name]) errors.push(`Required column "${name}" is empty`);
  }
  if (title.length > TITLE_MAX) errors.push(`Title is longer than ${TITLE_MAX} characters`);
  if (cells.description.length > DESCRIPTION_MAX) errors.push(`Description is longer than ${DESCRIPTION_MAX} characters`);
  const category = cells.category ? await lookupCategory(lookups, cells.category.toLowerCase()) : null;
  if (cells.category && !category) errors.push(`Unknown category "${cells.category}" (use the category slug)`);
  const place = cells.city ? await lookupPlace(lookups, cells, errors) : null;
  const attributes = category ? attributesFor(category, cells, errors) : null;
  const mediaIds = await resolvePhotos(partner.id, cells[PHOTO_COLUMN] ?? "", errors);
  if (category && attributes) {
    errors.push(...textErrors({ title, description: cells.description, attributes }, lookups.banned));
    const gate = evaluatePublishGate({
      dateOfBirth: partner.doc.dateOfBirth,
      attestedAdult: Boolean(partner.doc.attestedAdultAt),
      verificationStatus: partner.doc.verificationStatus,
      accountStatus: partner.doc.status,
      categorySlug: category.slug,
      categoryName: category.name,
      categoryEnabled: category.enabled !== false,
      mediaCleared: true,
      attributes,
    });
    if (!gate.ok) errors.push(`Cannot be published: ${gate.reason}`);
  }
  if (category && place && title) {
    const key = `${category._id.toString()}|${place.cityId}|${title.toLowerCase()}`;
    if (lookups.taken.has(key)) errors.push("A listing with the same title, category and city already exists");
    lookups.taken.add(key);
  }
  const report = { line, title, ok: errors.length === 0, errors };
  if (errors.length > 0 || !category || !place || !attributes) return { report };
  const input: RowInput = {
    categoryId: category._id.toString(),
    cityId: place.cityId,
    stateId: place.stateId,
    districtId: "districtId" in place ? place.districtId : undefined,
    title,
    description: cells.description,
    attributes,
    mediaIds,
  };
  return { report, input };
}

async function prepare(actor: ImportActor, partnerEmail: string, csv: string): Promise<Prepared> {
  assertStaff(actor);
  const { headers, body } = readTable(csv);
  const partner = await findPartner(partnerEmail);
  const existing = await Listing.find({ ownerId: partner.id, status: { $nin: ["removed", "deleted"] } })
    .select("title categoryId cityId")
    .lean<Array<Pick<ListingDoc, "title" | "categoryId" | "cityId">>>();
  const banned = (await BannedWord.find().select("text").lean())
    .map((row) => (typeof row.text === "string" ? row.text.trim().toLowerCase() : ""))
    .filter(Boolean);
  const lookups: Lookups = {
    banned,
    categories: new Map(),
    cities: new Map(),
    districts: new Map(),
    taken: new Set(existing.map((row) => `${row.categoryId}|${row.cityId}|${row.title.toLowerCase()}`)),
  };
  const plans: Plan[] = [];
  for (const [index, row] of body.entries()) {
    const cells: Record<string, string> = {};
    headers.forEach((name, column) => {
      cells[name] = clean(row[column] ?? "");
    });
    plans.push(await planRow(index + 2, cells, partner, lookups));
  }
  return { partner, plans };
}

function toReport(prepared: Prepared): DryRunReport {
  const { id, email, displayName } = prepared.partner;
  const rows = prepared.plans.map((plan) => plan.report);
  return { partner: { id, email, displayName }, total: rows.length, okCount: rows.filter((row) => row.ok).length, rows };
}

/** Step 1: validate every row with the post-form rules. Writes nothing. */
export async function dryRunImport(actor: ImportActor, partnerEmail: string, csv: string): Promise<DryRunReport> {
  return toReport(await prepare(actor, partnerEmail, csv));
}

async function uniqueSlug(title: string, id: Types.ObjectId) {
  const base = toSlug(title, 60);
  let slug = base;
  for (let n = 2; n < 50; n += 1) {
    if (!(await Listing.exists({ slug, _id: { $ne: id } }))) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${id.toString().slice(-6)}`;
}

async function finalise(id: string, status: ImportStatus, actor: ImportActor) {
  const listing = await Listing.findById(id);
  if (!listing) throw new NotFoundError("Not found");
  listing.status = status;
  listing.seoNoindex = status !== "active";
  listing.attestations = { importedBy: actor.id, importedAt: new Date().toISOString() };
  listing.markModified("attestations");
  if (status === "active") {
    listing.publishedAt = new Date();
    listing.expiresAt = new Date(Date.now() + LIFETIME_MS);
    listing.slug = await uniqueSlug(listing.title, listing._id);
  }
  await listing.save();
  const version = (await ListingVersion.countDocuments({ listingId: listing._id })) + 1;
  const snapshot = listing.toObject() as unknown as Record<string, unknown>;
  delete snapshot.__v;
  await ListingVersion.create({ listingId: listing._id, version, snapshot, actorId: actor.id });
}

/** Same call normal publishing makes (queueIndexNow), which batches the paths and does nothing without INDEXNOW_KEY. */
async function pingIndexNow(paths: string[]) {
  try {
    const { queueIndexNow } = await import("@/server/indexnow/ping");
    queueIndexNow(paths);
  } catch {
    /* a failed ping must never undo an import */
  }
}

async function importRow(input: RowInput, partnerId: string, status: ImportStatus, actor: ImportActor, requestId: string) {
  const draft = await createDraft(
    partnerId,
    { categoryId: input.categoryId, stateId: input.stateId, cityId: input.cityId, districtId: input.districtId },
    requestId,
  );
  const id = draft.id as string;
  try {
    await patchListing(id, partnerId, { stage: "basics", title: input.title, description: input.description }, requestId);
    await patchListing(id, partnerId, { stage: "details", attributes: input.attributes, contact: { acceptForm: true } }, requestId);
    if (input.mediaIds.length) await patchListing(id, partnerId, { stage: "photos", mediaIds: input.mediaIds }, requestId);
    await finalise(id, status, actor);
    if (status === "active") {
      const slug = (await Listing.findById(id).select("slug").lean<{ slug?: string }>())?.slug;
      if (slug) await pingIndexNow([`/ad/${slug}/`]);
    }
  } catch (error) {
    await Listing.updateOne({ _id: id }, { $set: { status: "removed" } });
    throw error;
  }
}

function message(error: unknown) {
  return error instanceof HttpError || error instanceof Error ? error.message : "Could not import this row";
}

async function refreshCaches() {
  try {
    const { refreshPublicCache } = await import("@/lib/cache");
    await refreshPublicCache();
  } catch {
    /* tests and scripts run outside a Next request */
  }
}

/**
 * Step 2: import the rows that pass. `pending` goes to the normal moderation queue.
 * `active` publishes at once and is for superadmin only.
 */
export async function runImport(
  actor: ImportActor,
  partnerEmail: string,
  csv: string,
  status: ImportStatus,
  requestId: string,
): Promise<ImportReport> {
  assertStaff(actor);
  if (status === "active" && !actor.roles.includes("superadmin")) {
    throw new ForbiddenError("Only a superadmin can publish an import directly");
  }
  const prepared = await prepare(actor, partnerEmail, csv);
  let imported = 0;
  for (const plan of prepared.plans) {
    if (!plan.input) continue;
    try {
      await importRow(plan.input, prepared.partner.id, status, actor, requestId);
      imported += 1;
    } catch (error) {
      plan.report.ok = false;
      plan.report.errors.push(message(error));
    }
  }
  const report = toReport(prepared);
  const failed = prepared.plans.filter((plan) => plan.input && !plan.report.ok).length;
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "listing.import",
    targetType: "user",
    targetId: prepared.partner.id,
    after: { rows: report.total, imported, failed, status },
    requestId,
  });
  if (status === "active") await refreshCaches();
  return { ...report, okCount: imported, status, imported, failed };
}
