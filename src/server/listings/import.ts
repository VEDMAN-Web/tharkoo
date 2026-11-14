import { Types } from "mongoose";
import { z } from "zod";
import { siteUrl } from "@/lib/utils";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, HttpError, NotFoundError, ValidationError } from "@/server/http";
import { adLifetimeMs } from "@/server/listings/lifetime";
import { parsePrice } from "@/server/listings/price";
import { parseCsv } from "@/server/listings/csv";
import { resolveSubcategory, categoryNeedsSubcategory } from "@/server/categories/public";
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
import { parseListingAttributes, type FieldDefinition } from "@/server/shared/fields";
import { textDenied } from "@/server/shared/policy";
import { evaluatePublishGate } from "@/server/shared/publish-gate";
import { toSlug } from "@/server/shared/slug";
import { assertVerified } from "@/server/verification/service";
import { assertRowCap, parsePhotoCell, photoLimitForImport } from "@/server/import/rules";

export { MAX_IMPORT_ROWS, IMPORT_CHUNK_ROWS } from "@/server/import/rules";
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const TITLE_MAX = 140;
const DESCRIPTION_MAX = 5000;
const REQUIRED_COLUMNS = ["category", "city", "title", "description"] as const;
const PHOTO_COLUMN = "photos";
const PHOTO_ALIASES = new Set(["photos", "photo_urls", "photo_url", "photo"]);
/** Key is the lower-cased file name. mediaId is "" until the photo is uploaded (dry run only needs the names). */
export type UploadedFiles = Map<string, { name: string; mediaId: string }>;

export function uploadedFromNames(names: readonly string[], known: Map<string, string> = new Map()): UploadedFiles {
  const files: UploadedFiles = new Map();
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key || files.has(key)) continue;
    files.set(key, { name: name.trim(), mediaId: known.get(key) ?? "" });
  }
  return files;
}
const BASE_COLUMNS = new Set<string>([...REQUIRED_COLUMNS, "district", "price", "subcategory", PHOTO_COLUMN]);
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

/** What the check found: how many ads and photos the import would create, and which chosen images it would upload. */
export interface PhotoSummary {
  ads: number;
  photosToAttach: number;
  filesToUpload: string[];
  unusedFiles: string[];
}

export interface DryRunReport {
  partner: { id: string; email: string; displayName: string };
  total: number;
  okCount: number;
  rows: ImportRowReport[];
  photos: PhotoSummary;
}

export interface ImportReport extends DryRunReport {
  status: ImportStatus;
  imported: number;
  failed: number;
}

/** A photo on a row: an existing upload (by id) or one of the chosen files (by name). */
export type RowPhoto = { kind: "id"; id: string } | { kind: "file"; name: string };

interface RowInput {
  categoryId: string;
  subcategoryId?: string;
  stateId?: string;
  cityId: string;
  districtId?: string;
  title: string;
  description: string;
  attributes: Record<string, unknown>;
  price?: number;
  photos: RowPhoto[];
}

interface Plan {
  report: ImportRowReport;
  input?: RowInput;
}

export interface Prepared {
  partner: { id: string; email: string; displayName: string; doc: UserRow };
  plans: Plan[];
  files: UploadedFiles;
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
  files: UploadedFiles;
  superadmin: boolean;
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
  const cap = assertRowCap(body.length);
  if (cap) throw new ValidationError(cap);
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

/** Reads the optional "subcategory" column. A blank cell is an error when the category has sub-categories. */
async function subcategoryOf(categoryId: string, value: string, errors: string[]) {
  const typed = value.trim();
  if (!typed) {
    if (await categoryNeedsSubcategory(categoryId)) errors.push('Required column "subcategory" is empty for this category');
    return undefined;
  }
  const id = await resolveSubcategory(categoryId, typed);
  if (!id) errors.push(`Unknown subcategory "${typed}" for this category (use its name or slug)`);
  return id ?? undefined;
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

async function photoByUrl(partnerId: string, url: string, errors: string[]): Promise<RowPhoto | null> {
  const candidates = photoCandidates(url);
  if (!candidates) {
    errors.push(`Photo URL is not from our own uploads: ${url.slice(0, 80)}`);
    return null;
  }
  const asset = await MediaAsset.findOne({ ownerId: partnerId, kind: "image", status: "cleared", objectKey: { $in: candidates } }).select("_id");
  if (!asset) {
    errors.push(`Photo is not among the partner's cleared uploads: ${url.slice(0, 80)}`);
    return null;
  }
  return { kind: "id", id: asset._id.toString() };
}

/** Each photo entry is a chosen file (by name) or an existing upload URL. A missing file is a row error. */
async function resolvePhotos(partnerId: string, cell: string, errors: string[], lookups: Lookups, categoryMax?: number | null) {
  const refs = parsePhotoCell(cell);
  if (refs.length === 0) return [];
  const limit = photoLimitForImport(lookups.superadmin, categoryMax);
  if (refs.length > limit) errors.push(`Too many photos: ${refs.length}. The limit is ${limit}`);
  const photos: RowPhoto[] = [];
  for (const ref of refs.slice(0, limit)) {
    if (ref.kind === "url") {
      const photo = await photoByUrl(partnerId, ref.value, errors);
      if (photo && photos.some((item) => item.kind === "id" && photo.kind === "id" && item.id === photo.id)) {
        errors.push(`The same photo is listed twice: ${ref.value.slice(0, 80)}`);
      } else if (photo) photos.push(photo);
      continue;
    }
    const file = lookups.files.get(ref.value.toLowerCase());
    if (!file) errors.push(`Missing file: ${ref.value.slice(0, 80)} is not among the chosen images`);
    else if (photos.some((item) => item.kind === "file" && item.name === file.name)) errors.push(`The same photo is listed twice: ${file.name}`);
    else photos.push({ kind: "file", name: file.name });
  }
  return photos;
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

function priceOf(cell: string | undefined, errors: string[]) {
  try {
    return parsePrice(cell) ?? undefined;
  } catch {
    errors.push(`Price "${cell}" must be a whole number of rupees, 0 or more`);
    return undefined;
  }
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
  const subcategoryId = category ? await subcategoryOf(category._id.toString(), cells.subcategory ?? "", errors) : undefined;
  const price = priceOf(cells.price, errors);
  const photos = await resolvePhotos(partner.id, cells[PHOTO_COLUMN] ?? "", errors, lookups, category?.importMaxPhotos);
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
    subcategoryId,
    cityId: place.cityId,
    stateId: place.stateId,
    districtId: "districtId" in place ? place.districtId : undefined,
    title,
    description: cells.description,
    attributes,
    price,
    photos,
  };
  return { report, input };
}

/** Validates every row of a file without writing. `files` maps chosen image names to uploads (or "" before upload). */
export async function prepareImport(actor: ImportActor, partnerEmail: string, csv: string, files: UploadedFiles): Promise<Prepared> {
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
    files,
    superadmin: actor.roles.includes("superadmin"),
  };
  const plans: Plan[] = [];
  for (const [index, row] of body.entries()) {
    const cells: Record<string, string> = {};
    headers.forEach((name, column) => {
      cells[name] = clean(row[column] ?? "");
    });
    plans.push(await planRow(index + 2, cells, partner, lookups));
  }
  return { partner, plans, files };
}

/** Counts for the check: ads and photos that would be created, and the chosen images no ready row uses. */
export function photoSummary(plans: Plan[], files: UploadedFiles): PhotoSummary {
  const ready = plans.filter((plan) => plan.input);
  const used = new Set<string>();
  let photosToAttach = 0;
  for (const plan of ready) {
    for (const photo of plan.input?.photos ?? []) {
      photosToAttach += 1;
      if (photo.kind === "file") used.add(photo.name.toLowerCase());
    }
  }
  const all = [...files.entries()];
  return {
    ads: ready.length,
    photosToAttach,
    filesToUpload: all.filter(([key]) => used.has(key)).map(([, file]) => file.name),
    unusedFiles: all.filter(([key]) => !used.has(key)).map(([, file]) => file.name),
  };
}

function toReport(prepared: Prepared): DryRunReport {
  const { id, email, displayName } = prepared.partner;
  const rows = prepared.plans.map((plan) => plan.report);
  return {
    partner: { id, email, displayName },
    total: rows.length,
    okCount: rows.filter((row) => row.ok).length,
    rows,
    photos: photoSummary(prepared.plans, prepared.files),
  };
}

/** Step 1: validate every row with the post-form rules. Writes nothing. `fileNames` are the chosen images. */
export async function dryRunImport(actor: ImportActor, partnerEmail: string, csv: string, fileNames: readonly string[] = []): Promise<DryRunReport> {
  return toReport(await prepareImport(actor, partnerEmail, csv, uploadedFromNames(fileNames)));
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
    listing.expiresAt = new Date(Date.now() + (await adLifetimeMs()));
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

/** The upload id behind a chosen file. Throws when the file has not been uploaded yet, so that row fails clearly. */
export function photoIdsFor(photos: RowPhoto[], files: UploadedFiles): string[] {
  return photos.map((photo) => {
    if (photo.kind === "id") return photo.id;
    const id = files.get(photo.name.toLowerCase())?.mediaId;
    if (!id) throw new Error(`Photo ${photo.name} is not uploaded yet`);
    return id;
  });
}

/**
 * Puts the photos on the listing. The import has already checked the photo limit for its own rule (photoLimitForImport),
 * so this skips the plan limit of the normal photo step, which would refuse a superadmin's category maximum.
 */
async function attachPhotos(listingId: string, mediaIds: string[]) {
  await Listing.updateOne(
    { _id: listingId },
    { $set: { mediaIds: mediaIds.map((id) => new Types.ObjectId(id)), coverMediaId: new Types.ObjectId(mediaIds[0]) } },
  );
  await MediaAsset.updateMany({ _id: { $in: mediaIds } }, { $set: { listingId: new Types.ObjectId(listingId) } });
}

async function importRow(input: RowInput, partnerId: string, status: ImportStatus, actor: ImportActor, requestId: string, files: UploadedFiles) {
  const mediaIds = photoIdsFor(input.photos, files);
  const draft = await createDraft(
    partnerId,
    { categoryId: input.categoryId, subcategoryId: input.subcategoryId, stateId: input.stateId, cityId: input.cityId, districtId: input.districtId },
    requestId,
  );
  const id = draft.id as string;
  try {
    await patchListing(id, partnerId, { stage: "basics", title: input.title, description: input.description }, requestId);
    await patchListing(id, partnerId, { stage: "details", attributes: input.attributes, price: input.price, contact: { acceptForm: true } }, requestId);
    if (mediaIds.length) await attachPhotos(id, mediaIds);
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

export async function refreshCaches() {
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
  assertPublishRight(actor, status);
  const prepared = await prepareImport(actor, partnerEmail, csv, uploadedFromNames([]));
  const { imported, failed } = await importPlanRange(prepared, 0, prepared.plans.length, actor, status, requestId);
  const report = toReport(prepared);
  await recordImportAudit(actor, prepared.partner.id, requestId, { rows: report.total, imported, failed, status });
  if (status === "active") await refreshCaches();
  return { ...report, okCount: imported, status, imported, failed };
}

export function assertPublishRight(actor: ImportActor, status: ImportStatus) {
  if (status === "active" && !actor.roles.includes("superadmin")) {
    throw new ForbiddenError("Only a superadmin can publish an import directly");
  }
}

/** Imports the ready rows in [from, to). A row that fails while saving is reported and the rest carry on. */
export async function importPlanRange(
  prepared: Prepared,
  from: number,
  to: number,
  actor: ImportActor,
  status: ImportStatus,
  requestId: string,
): Promise<{ imported: number; failed: number }> {
  let imported = 0;
  let failed = 0;
  for (const plan of prepared.plans.slice(from, to)) {
    if (!plan.input) continue;
    try {
      await importRow(plan.input, prepared.partner.id, status, actor, requestId, prepared.files);
      imported += 1;
    } catch (error) {
      plan.report.ok = false;
      plan.report.errors.push(message(error));
      failed += 1;
    }
  }
  return { imported, failed };
}

export async function recordImportAudit(
  actor: ImportActor,
  partnerId: string,
  requestId: string,
  after: { rows: number; imported: number; failed: number; status: ImportStatus; jobId?: string },
) {
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "listing.import",
    targetType: "user",
    targetId: partnerId,
    after,
    requestId,
  });
}
