import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { categoryNeedsSubcategory } from "@/server/categories/public";
import { isSiteMediaType, readImageSize } from "@/server/layout/media";
import { ConflictError, ForbiddenError, NotFoundError, PolicyViolationError, ValidationError } from "@/server/http";
import {
  assertPublishRight,
  attachPhotos,
  fieldDefs,
  finalise,
  findPartner,
  pingIndexNow,
  refreshCaches,
  textErrors,
  type ImportActor,
  type ImportStatus,
} from "@/server/listings/import";
import { createDraft, patchListing } from "@/server/listings/service";
import { uploadToCloudinary } from "@/server/media/client";
import {
  AD_MEDIA_LIMIT_MESSAGE,
  AD_MEDIA_MAX,
  CLOUDINARY_FOLDER,
  MAX_BYTES,
  STRIP_EXIF,
  UPLOAD_NEEDS_CLOUDINARY,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SECONDS,
  VIDEO_RULE_MESSAGE,
  VIDEO_TYPES,
  importPhotoLimit,
  onVercel,
  optionalCloudinary,
} from "@/server/media/config";
import { markWatermarked, prepareLocalAdFile } from "@/server/media/watermark";
import { csamScannerFromEnv } from "@/server/media/csam";
import { videoSeconds } from "@/server/media/duration";
import { BannedWord, Category, Listing, Location, MediaAsset, User, type CategoryDoc } from "@/server/models";
import { Subcategory } from "@/server/models/subcategory";
import { parseListingAttributes } from "@/server/shared/fields";
import { withPickLimits } from "@/server/fields/service";
import { idCheckRequired } from "@/server/settings/id-check";
import { evaluatePublishGate } from "@/server/shared/publish-gate";

const audit = new AuditRepository();
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const TITLE_MIN = 5;
const TITLE_MAX = 140;
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 5000;
const PRICE_MAX = 100_000_000;
const IMAGE_EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const VIDEO_EXTENSION: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

type CategoryRow = CategoryDoc & { _id: Types.ObjectId };
type PlaceRow = { _id: Types.ObjectId; type: string; parentId?: Types.ObjectId | null };
type Owner = Awaited<ReturnType<typeof findPartner>>;

export interface AdminMediaFile {
  name: string;
  type: string;
  data: Buffer;
}

/** Photo limit for a staff-made ad: the category's own maximum, or the default of 10. Same rule as the import. */
export function adPhotoLimit(categoryMax?: number | null) {
  return importPhotoLimit(categoryMax);
}

const objectId = z.string().regex(OBJECT_ID, "Choose from the list");

export const adminAdSchema = z.object({
  /** Blank means the staff account itself. Otherwise the email of an existing account. */
  ownerEmail: z.string().trim().max(254).default(""),
  categoryId: objectId,
  subcategoryId: z.string().trim().max(64).default(""),
  cityId: objectId,
  districtId: z.string().trim().max(64).default(""),
  title: z.string().max(400),
  description: z.string().max(10000),
  price: z.number().int().min(0).max(PRICE_MAX).nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  photoIds: z.array(objectId).max(AD_MEDIA_MAX).default([]),
  videoIds: z.array(objectId).max(AD_MEDIA_MAX).default([]),
  status: z.enum(["pending", "active"]),
});

export type AdminAdInput = z.input<typeof adminAdSchema>;
type ParsedAd = z.output<typeof adminAdSchema>;

interface Resolved {
  category: CategoryRow;
  attributes: Record<string, unknown>;
  subcategoryId?: string;
  place: { cityId: string; stateId?: string; districtId?: string };
}

function assertStaff(actor: ImportActor) {
  if (!actor.roles.some((role) => role === "admin" || role === "superadmin")) throw new ForbiddenError("Only an admin or a superadmin can create ads");
}

/** The staff member as an actor. The account id is looked up from the session email. */
export async function actorForStaff(identity: { email: string; roles: string[] }): Promise<ImportActor | null> {
  if (!identity.email) return null;
  await connectDb();
  const user = await User.findOne({ email: identity.email.trim().toLowerCase() }).select("_id").lean<{ _id: Types.ObjectId }>();
  return user ? { id: user._id.toString(), roles: identity.roles } : null;
}

/** The account the ad is posted for: the staff account when no email is given, otherwise the account with that email. */
async function ownerOf(actor: ImportActor, ownerEmail: string): Promise<Owner> {
  const typed = ownerEmail.trim();
  if (typed) return findPartner(typed);
  const self = await User.findById(actor.id).select("email").lean<{ email?: string }>();
  if (!self?.email) throw new NotFoundError("Staff account not found");
  return findPartner(self.email);
}

function textRules(title: string, description: string, errors: string[]) {
  const alnum = (title.match(/[a-z0-9]/gi) || []).length;
  if (title.length < TITLE_MIN || alnum < TITLE_MIN) errors.push(`Title needs at least ${TITLE_MIN} letters or numbers`);
  if (title.length > TITLE_MAX) errors.push(`Title is longer than ${TITLE_MAX} characters`);
  if (description.length < DESCRIPTION_MIN) errors.push(`Description needs at least ${DESCRIPTION_MIN} characters`);
  if (description.length > DESCRIPTION_MAX) errors.push(`Description is longer than ${DESCRIPTION_MAX} characters`);
}

/** Field rules are the category's own: the same parse the post form and the import use. Null when a field is wrong. */
async function checkAttributes(category: CategoryRow, attributes: Record<string, unknown>, errors: string[]) {
  const defs = await withPickLimits(category.slug, fieldDefs(category));
  const labels = new Map(defs.map((def) => [def.key, def.label]));
  try {
    return parseListingAttributes(defs, attributes);
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    for (const issue of error.issues) {
      if (issue.code === "unrecognized_keys") errors.push(`This category has no field "${issue.keys.join(", ")}"`);
      else {
        const key = String(issue.path[0] ?? "");
        errors.push(`Field "${labels.get(key) ?? key}": ${issue.message}`);
      }
    }
    return null;
  }
}

async function checkSubcategory(categoryId: Types.ObjectId, subcategoryId: string, errors: string[]) {
  if (!subcategoryId) {
    if (await categoryNeedsSubcategory(categoryId.toString())) errors.push("Choose a sub-category");
    return undefined;
  }
  const sub = await Subcategory.findOne({ _id: subcategoryId, categoryId }).select("_id").lean();
  if (!sub) {
    errors.push("That sub-category is not in this category");
    return undefined;
  }
  return subcategoryId;
}

async function checkPlace(input: ParsedAd, errors: string[]): Promise<Resolved["place"] | null> {
  const city = (await Location.findOne({ _id: input.cityId, type: "city", enabled: { $ne: false } }).lean()) as PlaceRow | null;
  if (!city) {
    errors.push("Choose a city");
    return null;
  }
  const state = city.parentId ? ((await Location.findById(city.parentId).select("type").lean()) as PlaceRow | null) : null;
  const stateId = state?.type === "state" ? state._id.toString() : undefined;
  if (!input.districtId) return { cityId: city._id.toString(), stateId };
  const district = await Location.findOne({ _id: input.districtId, type: "district", parentId: city._id, enabled: { $ne: false } }).select("_id").lean();
  if (!district) {
    errors.push("That district is not in this city");
    return null;
  }
  return { cityId: city._id.toString(), stateId, districtId: input.districtId };
}

async function checkDuplicate(ownerId: string, categoryId: Types.ObjectId, cityId: string, title: string, errors: string[]) {
  const rows = await Listing.find({ ownerId, categoryId, cityId, status: { $nin: ["removed", "deleted"] } }).select("title").lean<Array<{ title: string }>>();
  if (rows.some((row) => row.title.trim().toLowerCase() === title.trim().toLowerCase())) {
    errors.push("A listing with the same title, category and city already exists for this account");
  }
}

/** Photos and videos must be cleared uploads of this account that are not on another ad yet. */
async function checkMedia(ownerId: string, ids: string[], kind: "image" | "video", errors: string[]) {
  if (new Set(ids).size !== ids.length) errors.push("The same file is listed twice");
  if (ids.length === 0) return;
  const found = await MediaAsset.find({ _id: { $in: ids }, ownerId, kind, status: "cleared", listingId: null }).select("_id").lean();
  if (found.length !== ids.length) errors.push(`Some ${kind === "image" ? "photos" : "videos"} are not ready to attach. Upload them again`);
}

async function bannedWords() {
  return (await BannedWord.find().select("text").lean())
    .map((row) => (typeof row.text === "string" ? row.text.trim().toLowerCase() : ""))
    .filter(Boolean);
}

function gateErrors(owner: Owner, category: CategoryRow, attributes: Record<string, unknown>, errors: string[], requireIdCheck: boolean) {
  const gate = evaluatePublishGate({
    dateOfBirth: owner.doc.dateOfBirth,
    idCheckRequired: requireIdCheck,
    attestedAdult: Boolean(owner.doc.attestedAdultAt),
    verificationStatus: owner.doc.verificationStatus,
    accountStatus: owner.doc.status,
    categorySlug: category.slug,
    categoryName: category.name,
    categoryEnabled: category.enabled !== false,
    mediaCleared: true,
    attributes,
  });
  if (!gate.ok) errors.push(`Cannot be published: ${gate.reason}`);
}

/** Checks everything the form sends. Writes nothing. `resolved` is set only when the ad can be created. */
async function checkAd(input: ParsedAd, owner: Owner): Promise<{ errors: string[]; resolved: Resolved | null }> {
  const errors: string[] = [];
  const title = input.title.trim();
  const description = input.description.trim();
  textRules(title, description, errors);
  const category = (await Category.findOne({ _id: input.categoryId, deletedAt: null }).lean()) as CategoryRow | null;
  if (!category || category.enabled === false) return { errors: [...errors, "Choose a category"], resolved: null };
  const attributes = await checkAttributes(category, input.attributes, errors);
  const subcategoryId = await checkSubcategory(category._id, input.subcategoryId, errors);
  const place = await checkPlace(input, errors);
  const limit = adPhotoLimit(category.importMaxPhotos);
  if (input.photoIds.length > limit) errors.push(`Too many photos: ${input.photoIds.length}. The limit for this category is ${limit}`);
  if (input.photoIds.length + input.videoIds.length > AD_MEDIA_MAX) errors.push(AD_MEDIA_LIMIT_MESSAGE);
  await checkMedia(owner.id, input.photoIds, "image", errors);
  await checkMedia(owner.id, input.videoIds, "video", errors);
  if (place) await checkDuplicate(owner.id, category._id, place.cityId, title, errors);
  if (attributes) {
    errors.push(...textErrors({ title, description, attributes }, await bannedWords()));
    gateErrors(owner, category, attributes, errors, await idCheckRequired());
  }
  if (errors.length || !attributes || !place) return { errors, resolved: null };
  return { errors, resolved: { category, attributes, subcategoryId, place } };
}

async function writeAd(actor: ImportActor, input: ParsedAd, owner: Owner, resolved: Resolved, requestId: string) {
  const title = input.title.trim();
  const description = input.description.trim();
  const draft = await createDraft(
    owner.id,
    { categoryId: resolved.category._id.toString(), subcategoryId: resolved.subcategoryId, cityId: resolved.place.cityId, stateId: resolved.place.stateId, districtId: resolved.place.districtId },
    requestId,
  );
  const id = draft.id as string;
  try {
    await patchListing(id, owner.id, { stage: "basics", title, description }, requestId);
    await patchListing(id, owner.id, { stage: "details", attributes: resolved.attributes, price: input.price ?? undefined, contact: { acceptForm: true } }, requestId);
    if (input.photoIds.length) await attachPhotos(id, input.photoIds);
    if (input.videoIds.length) await MediaAsset.updateMany({ _id: { $in: input.videoIds } }, { $set: { listingId: new Types.ObjectId(id) } });
    await finalise(id, input.status, actor);
  } catch (error) {
    await Listing.updateOne({ _id: id }, { $set: { status: "removed" } });
    throw error;
  }
  return id;
}

/**
 * Creates one ad for an account (the staff account or a chosen user). The ad goes to the moderation queue,
 * or is published at once for a superadmin. Audited with the staff actor and the owner account.
 */
export async function createAdminAd(actor: ImportActor, raw: unknown, requestId: string): Promise<{ id: string; status: ImportStatus; ownerId: string }> {
  assertStaff(actor);
  const parsed = adminAdSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form");
  const input = parsed.data;
  assertPublishRight(actor, input.status);
  await connectDb();
  const owner = await ownerOf(actor, input.ownerEmail);
  const checked = await checkAd(input, owner);
  if (!checked.resolved) throw new ValidationError(checked.errors.join("; ") || "Check the form");
  const id = await writeAd(actor, input, owner, checked.resolved, requestId);
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "listing.admin_create",
    targetType: "listing",
    targetId: id,
    after: {
      ownerId: owner.id,
      ownerEmail: owner.email,
      status: input.status,
      photos: input.photoIds.length,
      videos: input.videoIds.length,
      categoryId: input.categoryId,
      cityId: input.cityId,
    },
    requestId,
  });
  if (input.status === "active") {
    await refreshCaches();
    const slug = (await Listing.findById(id).select("slug").lean<{ slug?: string }>())?.slug;
    if (slug) await pingIndexNow([`/ad/${slug}/`]);
  }
  return { id, status: input.status, ownerId: owner.id };
}

async function writeLocalFile(id: Types.ObjectId, extension: string, data: Buffer) {
  const name = `${id.toHexString()}.${extension}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), data);
  return `/uploads/${name}`;
}

async function storeImage(file: AdminMediaFile, id: Types.ObjectId): Promise<string> {
  if (optionalCloudinary()) {
    const stored = await uploadToCloudinary(file.data, { contentType: file.type, folder: `${CLOUDINARY_FOLDER}/listings`, publicId: id.toHexString(), transformation: STRIP_EXIF });
    return stored.publicId;
  }
  if (onVercel()) throw new ConflictError(`${UPLOAD_NEEDS_CLOUDINARY}. Add the Cloudinary settings, then try again.`);
  return writeLocalFile(id, IMAGE_EXTENSION[file.type], file.data);
}

/** Videos are stored on this server's disk only. Cloudinary video upload is not wired for staff yet. */
async function storeVideo(file: AdminMediaFile, id: Types.ObjectId): Promise<string> {
  if (optionalCloudinary() || onVercel()) throw new ConflictError("Videos cannot be uploaded from this screen on this server yet. Use the post-ad form instead.");
  return writeLocalFile(id, VIDEO_EXTENSION[file.type], file.data);
}

function assertImage(file: AdminMediaFile) {
  if (!isSiteMediaType(file.type) || file.data.length === 0 || file.data.length > MAX_BYTES) {
    throw new PolicyViolationError("Only jpeg, png, and webp photos up to 8 MB are allowed");
  }
  if (!readImageSize(file.data, file.type)) throw new ValidationError(`${file.name} is not a valid jpeg, png or webp image`);
}

function assertVideo(file: AdminMediaFile) {
  const seconds = (VIDEO_TYPES as readonly string[]).includes(file.type) ? videoSeconds(file.data, file.type) : null;
  if (!(VIDEO_TYPES as readonly string[]).includes(file.type) || file.data.length > VIDEO_MAX_BYTES || seconds === null || seconds > VIDEO_MAX_SECONDS) {
    throw new PolicyViolationError(VIDEO_RULE_MESSAGE);
  }
}

async function removeStored(objectKey: string) {
  if (objectKey.startsWith("/uploads/")) await unlink(path.join(process.cwd(), "public", "uploads", path.basename(objectKey))).catch(() => undefined);
}

/** Stores one photo or video for the owner account. The file is checked and scanned before it is marked cleared. */
export async function storeAdminMedia(actor: ImportActor, ownerEmail: string, kind: "image" | "video", file: AdminMediaFile, requestId: string) {
  assertStaff(actor);
  await connectDb();
  const owner = await ownerOf(actor, ownerEmail);
  if (kind === "video") assertVideo(file);
  else assertImage(file);
  const id = new Types.ObjectId();
  // H6.18: on the local disk fallback the photo is marked before it is written (a video is refused while the watermark is on).
  const local = !optionalCloudinary() && !onVercel();
  const prepared = local ? await prepareLocalAdFile(kind, file) : { data: file.data, watermarked: false };
  const stored = { ...file, data: prepared.data };
  const objectKey = kind === "video" ? await storeVideo(stored, id) : await storeImage(stored, id);
  if (prepared.watermarked) await markWatermarked(objectKey);
  const scan = await csamScannerFromEnv().scan({ objectKey, contentType: file.type, bytes: stored.data.length });
  if (scan.match) {
    await removeStored(objectKey);
    throw new PolicyViolationError("Upload was rejected");
  }
  await MediaAsset.create({ _id: id, ownerId: owner.id, kind, objectKey, status: "cleared", clearedAt: new Date(), contentType: file.type, bytes: stored.data.length });
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "media.admin_upload",
    targetType: "media",
    targetId: id.toHexString(),
    after: { ownerId: owner.id, ownerEmail: owner.email, kind, bytes: stored.data.length },
    requestId,
  });
  return { mediaId: id.toHexString(), kind, name: file.name };
}
