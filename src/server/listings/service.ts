import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { isStaffRole } from "@/server/auth/service";
import {
  ConflictError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  PolicyViolationError,
  UnauthorizedError,
  ValidationError,
  VerificationRequiredError,
} from "@/server/http";
import {
  BannedWord,
  Category,
  Listing,
  ListingVersion,
  Location,
  MediaAsset,
  Site,
  PromotionOrder,
  User,
  type CategoryDoc,
  type ListingContactDoc,
  type ListingDoc,
  type ListingStatus,
} from "@/server/models";
import { photoLimit } from "@/server/media/config";
import { assertVerified } from "@/server/verification/service";
import { hashIp } from "@/server/shared/crypto";
import { parseListingAttributes, type FieldDefinition } from "@/server/shared/fields";
import { attributeDenied, categoryDenied, textDenied } from "@/server/shared/policy";
import { evaluatePublishGate } from "@/server/shared/publish-gate";
import { toSlug } from "@/server/shared/slug";

const LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const REVEAL_WINDOW_MS = 60 * 60 * 1000;
const REVEAL_TTL_MS = 15 * 60 * 1000;
const COUNTED = ["pending", "active", "paused", "rejected", "expired", "archived"] as const;
const OWNER_HIDDEN = new Set<ListingStatus>(["draft", "pending", "rejected", "paused", "expired", "archived"]);

const audit = new AuditRepository();

type ListingRow = mongoose.Document & ListingDoc & { _id: Types.ObjectId };

export class FreeLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super("FREE_LIMIT");
    this.name = "FreeLimitError";
    this.retryAfter = retryAfter;
  }
}

export class RevealLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super("Too many requests");
    this.name = "RevealLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Removed listings are gone. The envelope code stays NOT_FOUND because that is the existing error union. */
export class GoneError extends HttpError {
  constructor() {
    super(410, "NOT_FOUND", "Listing removed");
    this.name = "GoneError";
  }
}

function intEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function weekStart(now = new Date()) {
  const day = now.getUTCDay() || 7;
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(midnight - (day - 1) * 24 * 60 * 60 * 1000);
}

function iso(value?: Date | null) {
  return value ? new Date(value).toISOString() : null;
}

function idOf(value?: Types.ObjectId | null) {
  return value ? value.toString() : null;
}

function secretsOf(contact?: ListingContactDoc | null) {
  return [contact?.phone, contact?.whatsapp, contact?.telegram].filter(
    (value): value is string => Boolean(value && value.length >= 6),
  );
}

function stripSecrets(text: string, secrets: string[]) {
  return secrets.reduce((current, secret) => current.split(secret).join(""), text);
}

function publicAttributes(attributes: Record<string, unknown> | undefined, secrets: string[]) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes ?? {})) {
    if (typeof value === "string" && secrets.some((secret) => value.includes(secret))) continue;
    output[key] = value;
  }
  return output;
}

export function publicView(listing: ListingDoc) {
  const secrets = secretsOf(listing.contact);
  return {
    id: idOf(listing._id),
    slug: listing.slug ?? null,
    title: stripSecrets(listing.title, secrets),
    description: stripSecrets(listing.description, secrets),
    status: listing.status,
    categoryId: idOf(listing.categoryId),
    stateId: idOf(listing.stateId),
    cityId: idOf(listing.cityId),
    districtId: idOf(listing.districtId),
    localityId: idOf(listing.localityId),
    attributes: publicAttributes(listing.attributes, secrets),
    mediaIds: (listing.mediaIds ?? []).map((id) => id.toString()),
    coverMediaId: idOf(listing.coverMediaId),
    badges: listing.badges ?? [],
    qualityScore: listing.qualityScore ?? 0,
    publishedAt: iso(listing.publishedAt),
    expiresAt: iso(listing.expiresAt),
    seoNoindex: listing.seoNoindex !== false,
    createdAt: iso(listing.createdAt),
    updatedAt: iso(listing.updatedAt),
  };
}

export function ownerView(listing: ListingDoc) {
  return {
    ...publicView(listing),
    ownerId: idOf(listing.ownerId),
    contact: {
      phone: listing.contact?.phone ?? null,
      whatsapp: listing.contact?.whatsapp ?? null,
      telegram: listing.contact?.telegram ?? null,
      acceptForm: Boolean(listing.contact?.acceptForm),
    },
    attestations: listing.attestations ?? {},
  };
}

function assertTransition(from: ListingStatus, to: ListingStatus) {
  const allowed: Record<ListingStatus, ListingStatus[]> = {
    draft: ["pending", "active", "removed"],
    pending: ["active", "rejected", "removed"],
    rejected: ["pending", "removed"],
    active: ["paused", "pending", "expired", "removed"],
    paused: ["active", "removed"],
    expired: ["active", "removed"],
    archived: ["removed"],
    removed: [],
    deleted: ["removed"],
  };
  if (!allowed[from].includes(to)) throw new ConflictError(`Cannot move from ${from} to ${to}`);
}

async function load(id: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Not found");
  const listing = await Listing.findById(id).select("+contact");
  if (!listing) throw new NotFoundError("Not found");
  return listing as ListingRow;
}

async function owned(id: string, userId: string) {
  const listing = await load(id);
  if (listing.ownerId.toString() !== userId) throw new ForbiddenError("Forbidden");
  return listing;
}

async function requireCategory(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ValidationError("Invalid request", { categoryId: ["Invalid id"] });
  }
  const category = await Category.findById(id);
  if (!category || category.deletedAt) throw new NotFoundError("Category not found");
  if (category.enabled === false || categoryDenied(category.slug, category.name).denied) {
    throw new PolicyViolationError("Category is not allowed");
  }
  return category;
}

async function requirePlace(id: string | undefined, field: string) {
  if (!id) return undefined;
  if (!mongoose.isValidObjectId(id)) throw new ValidationError("Invalid request", { [field]: ["Invalid id"] });
  const place = await Location.findById(id);
  if (!place || place.enabled === false) throw new NotFoundError("Location not found");
  return place._id;
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

async function promoted(listing: ListingRow) {
  if (listing.badges?.some((badge) => badge && badge !== "free")) return true;
  return Boolean(
    await PromotionOrder.exists({
      listingId: listing._id,
      status: "active",
      $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gt: new Date() } }],
    }),
  );
}

async function assertPhotos(ownerId: string, listing: ListingRow, mediaIds: string[], coverMediaId?: string) {
  if (new Set(mediaIds).size !== mediaIds.length) {
    throw new ValidationError("Invalid request", { mediaIds: ["Duplicate photos"] });
  }
  const limit = photoLimit(await promoted(listing));
  if (mediaIds.length > limit) throw new PolicyViolationError("Photo limit reached");
  if (coverMediaId && !mediaIds.includes(coverMediaId)) {
    throw new ValidationError("Invalid request", { coverMediaId: ["Cover must be one of the photos"] });
  }
  if (mediaIds.length === 0) return;
  const assets = await MediaAsset.find({ _id: { $in: mediaIds } });
  if (assets.length !== mediaIds.length) throw new NotFoundError("Media not found");
  for (const asset of assets) {
    if (asset.ownerId.toString() !== ownerId) throw new ForbiddenError("Forbidden");
    if (asset.kind === "id_document" || asset.status !== "cleared") {
      throw new PolicyViolationError("MEDIA_NOT_CLEARED");
    }
  }
}

async function assertCleanText(parts: Array<string | undefined>) {
  const text = parts.filter((part): part is string => Boolean(part?.trim())).join("\n");
  if (!text) return;
  if (textDenied(text).denied) throw new PolicyViolationError("Listing text is not allowed");
  const rows = await BannedWord.find().select("text").lean();
  const haystack = text.toLowerCase();
  for (const row of rows) {
    const needle = typeof row.text === "string" ? row.text.trim().toLowerCase() : "";
    if (needle && haystack.includes(needle)) throw new PolicyViolationError("Listing text is not allowed");
  }
}

async function writeVersion(listing: ListingRow, actorId: string) {
  const version = (await ListingVersion.countDocuments({ listingId: listing._id })) + 1;
  const snapshot = listing.toObject() as Record<string, unknown>;
  delete snapshot.__v;
  await ListingVersion.create({ listingId: listing._id, version, snapshot, actorId });
}

async function record(
  userId: string | null,
  actorType: "user" | "system",
  action: string,
  targetId: string,
  requestId: string,
  after?: Record<string, unknown>,
  ip?: string,
) {
  await audit.append({
    actorId: userId,
    actorType,
    action,
    targetType: "listing",
    targetId,
    requestId,
    after,
    ipHash: hashIp(ip),
  });
}

async function assignSlug(listing: ListingRow) {
  const base = toSlug(listing.title, 60);
  let slug = base;
  for (let n = 2; n < 50; n += 1) {
    const taken = await Listing.exists({ slug, _id: { $ne: listing._id } });
    if (!taken) {
      listing.slug = slug;
      return;
    }
    slug = `${base}-${n}`;
  }
  listing.slug = `${base}-${listing._id.toString().slice(-6)}`;
}

export async function createDraft(
  userId: string,
  input: {
    categoryId: string;
    title?: string;
    description?: string;
    stateId?: string;
    cityId?: string;
    districtId?: string;
    localityId?: string;
  },
  requestId: string,
) {
  await connectDb();
  const category = await requireCategory(input.categoryId);
  const listing = await Listing.create({
    ownerId: userId,
    status: "draft",
    categoryId: category._id,
    stateId: await requirePlace(input.stateId, "stateId"),
    cityId: await requirePlace(input.cityId, "cityId"),
    districtId: await requirePlace(input.districtId, "districtId"),
    localityId: await requirePlace(input.localityId, "localityId"),
    title: input.title?.trim() || "Untitled",
    description: input.description?.trim() || "Draft",
    attributes: {},
    mediaIds: [],
    seoNoindex: true,
  });
  const saved = await load(listing._id.toString());
  await record(userId, "user", "listing.create", saved._id.toString(), requestId, { status: "draft" });
  return ownerView(saved);
}

export async function listOwn(userId: string, query: { status?: ListingStatus; page: number; pageSize: number }) {
  await connectDb();
  const filter: Record<string, unknown> = { ownerId: userId };
  if (query.status) filter.status = query.status;
  const [rows, total] = await Promise.all([
    Listing.find(filter)
      .select("+contact")
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize),
    Listing.countDocuments(filter),
  ]);
  return { items: rows.map((row) => ownerView(row)), total };
}

export async function readOwned(id: string, userId: string, roles: string[]) {
  const listing = await load(id);
  if (listing.ownerId.toString() !== userId && !isStaffRole(roles)) throw new ForbiddenError("Forbidden");
  return ownerView(listing);
}

export async function readPublic(key: string, viewerId?: string) {
  await connectDb();
  let listing: ListingRow | null = null;
  if (/^[a-f0-9]{24}$/i.test(key)) listing = (await Listing.findById(key).select("+contact")) as ListingRow | null;
  listing ??= (await Listing.findOne({ slug: key }).select("+contact")) as ListingRow | null;
  if (!listing) throw new NotFoundError("Not found");
  if (listing.status === "removed" || listing.status === "deleted") throw new GoneError();
  const owner = Boolean(viewerId && listing.ownerId.toString() === viewerId);
  if (listing.status !== "active" && !(owner && OWNER_HIDDEN.has(listing.status))) {
    throw new NotFoundError("Not found");
  }
  return publicView(listing);
}

async function applyBasics(
  listing: ListingRow,
  input: {
    categoryId?: string;
    title?: string;
    description?: string;
    stateId?: string;
    cityId?: string;
    districtId?: string;
    localityId?: string;
  },
) {
  if (input.categoryId) listing.categoryId = (await requireCategory(input.categoryId))._id;
  if (input.title) listing.title = input.title;
  if (input.description) listing.description = input.description;
  if (input.stateId) listing.stateId = await requirePlace(input.stateId, "stateId");
  if (input.cityId) listing.cityId = await requirePlace(input.cityId, "cityId");
  if (input.districtId) listing.districtId = await requirePlace(input.districtId, "districtId");
  if (input.localityId) listing.localityId = await requirePlace(input.localityId, "localityId");
  await assertCleanText([input.title, input.description]);
  return input.categoryId !== undefined || input.title !== undefined || input.description !== undefined;
}

async function applyDetails(
  listing: ListingRow,
  input: { attributes?: Record<string, unknown>; contact?: ListingContactDoc },
) {
  if (input.attributes) {
    const denied = attributeDenied(input.attributes);
    if (denied.denied) throw new PolicyViolationError("Listing text is not allowed");
    const strings = Object.values(input.attributes).filter((value): value is string => typeof value === "string");
    await assertCleanText(strings);
    listing.attributes = input.attributes;
    listing.markModified("attributes");
  }
  if (input.contact) {
    await assertCleanText([input.contact.phone, input.contact.whatsapp, input.contact.telegram]);
    listing.contact = input.contact;
    listing.markModified("contact");
  }
  return input.contact !== undefined;
}

export async function patchListing(
  id: string,
  userId: string,
  input:
    | {
        stage: "basics";
        categoryId?: string;
        title?: string;
        description?: string;
        stateId?: string;
        cityId?: string;
        districtId?: string;
        localityId?: string;
      }
    | { stage: "details"; attributes?: Record<string, unknown>; contact?: ListingContactDoc }
    | { stage: "photos"; mediaIds: string[]; coverMediaId?: string },
  requestId: string,
) {
  const listing = await owned(id, userId);
  if (listing.status === "removed" || listing.status === "deleted") throw new ConflictError("Listing is removed");
  let sensitive = false;
  if (input.stage === "basics") sensitive = await applyBasics(listing, input);
  if (input.stage === "details") sensitive = await applyDetails(listing, input);
  if (input.stage === "photos") {
    await assertPhotos(userId, listing, input.mediaIds, input.coverMediaId);
    listing.mediaIds = input.mediaIds.map((mediaId) => new mongoose.Types.ObjectId(mediaId));
    listing.coverMediaId = input.coverMediaId
      ? new mongoose.Types.ObjectId(input.coverMediaId)
      : input.mediaIds[0]
        ? new mongoose.Types.ObjectId(input.mediaIds[0])
        : undefined;
    sensitive = true;
  }
  if (sensitive && listing.status === "active") {
    assertTransition(listing.status, "pending");
    listing.status = "pending";
    listing.seoNoindex = true;
    await listing.save();
    await writeVersion(listing, userId);
  } else {
    await listing.save();
  }
  await record(userId, "user", "listing.update", listing._id.toString(), requestId, { status: listing.status, stage: input.stage });
  return ownerView(listing);
}

export async function submitListing(
  id: string,
  userId: string,
  attestations: { adult: true; accurate: true; rights: true },
  requestId: string,
) {
  const listing = await owned(id, userId);
  assertTransition(listing.status, "active");
  if (!listing.title.trim() || !listing.description.trim() || !listing.cityId) {
    throw new ValidationError("Invalid request", { listing: ["Title, description, and city are required"] });
  }
  const contact = listing.contact ?? {};
  if (!contact.phone && !contact.whatsapp && !contact.telegram && !contact.acceptForm) {
    throw new ValidationError("Invalid request", { contact: ["Add a contact method"] });
  }
  await assertVerified(userId);
  const user = await User.findById(userId);
  if (!user || user.status !== "active") throw new UnauthorizedError("Sign in required");
  const category = await requireCategory(listing.categoryId.toString());
  const attributes = parseListingAttributes(fieldDefs(category), listing.attributes ?? {});
  listing.attributes = attributes;
  listing.markModified("attributes");
  const mediaIds = listing.mediaIds ?? [];
  const assets = mediaIds.length ? await MediaAsset.find({ _id: { $in: mediaIds } }) : [];
  const mediaCleared =
    assets.length === mediaIds.length &&
    assets.every((asset) => asset.ownerId.toString() === userId && asset.status === "cleared" && asset.kind !== "id_document");
  if (mediaIds.length > photoLimit(await promoted(listing))) throw new PolicyViolationError("Photo limit reached");
  const gate = evaluatePublishGate({
    dateOfBirth: user.dateOfBirth,
    attestedAdult: Boolean(user.attestedAdultAt),
    verificationStatus: user.verificationStatus,
    accountStatus: user.status,
    categorySlug: category.slug,
    categoryName: category.name,
    categoryEnabled: category.enabled !== false,
    mediaCleared: mediaIds.length === 0 || mediaCleared,
    attributes,
  });
  if (!gate.ok) {
    if (gate.reason === "VERIFICATION_REQUIRED") throw new VerificationRequiredError("Identity verification is required");
    throw new PolicyViolationError(gate.reason === "MEDIA_NOT_CLEARED" ? "MEDIA_NOT_CLEARED" : gate.reason);
  }
  await assertCleanText([
    listing.title,
    listing.description,
    contact.phone,
    contact.whatsapp,
    contact.telegram,
    ...Object.values(attributes).filter((value): value is string => typeof value === "string"),
  ]);
  const start = weekStart().toISOString();
  const previous = listing.attestations?.submittedAt;
  const already = typeof previous === "string" && previous >= start;
  const used = await Listing.countDocuments({
    ownerId: listing.ownerId,
    _id: { $ne: listing._id },
    status: { $in: COUNTED },
    "attestations.submittedAt": { $gte: start },
  });
  const site = await Site.findOne({ key: "default" }).select("freeAdsPerWeek").lean<{ freeAdsPerWeek?: number }>();
  const limit = typeof site?.freeAdsPerWeek === "number" ? site.freeAdsPerWeek : intEnv("FREE_ADS_PER_WEEK", 3);
  if (!already && used >= limit) {
    const retryAfter = Math.max(1, Math.ceil((weekStart().getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now()) / 1000));
    throw new FreeLimitError(retryAfter);
  }
  listing.status = "active";
  listing.seoNoindex = false;
  if (!listing.publishedAt) listing.publishedAt = new Date();
  listing.expiresAt = new Date(Date.now() + LIFETIME_MS);
  listing.attestations = { ...attestations, submittedAt: new Date().toISOString() };
  listing.markModified("attestations");
  await assignSlug(listing);
  await listing.save();
  await writeVersion(listing, userId);
  await record(userId, "user", "listing.submit", listing._id.toString(), requestId, { status: "active" });
  try {
    const { refreshPublicCache } = await import("@/lib/cache");
    await refreshPublicCache();
    const { revalidatePath } = await import("next/cache");
    if (listing.slug) revalidatePath(`/ad/${listing.slug}/`);
    if (category.slug) revalidatePath(`/${category.slug}/`);
  } catch {
    /* unit tests run outside a Next request */
  }
  if (listing.slug) notifyIndexNow([`/ad/${listing.slug}/`]);
  return { status: "active" as const };
}

async function move(id: string, userId: string, to: ListingStatus, action: string, requestId: string) {
  const listing = await owned(id, userId);
  assertTransition(listing.status, to);
  listing.status = to;
  await listing.save();
  if (listing.slug && (to === "removed" || to === "expired" || to === "deleted")) notifyIndexNow([`/ad/${listing.slug}/`]);
  await record(userId, "user", action, listing._id.toString(), requestId, { status: to });
  return listing;
}

export async function pauseListing(id: string, userId: string, requestId: string) {
  return ownerView(await move(id, userId, "paused", "listing.pause", requestId));
}

export async function resumeListing(id: string, userId: string, requestId: string) {
  const listing = await owned(id, userId);
  assertTransition(listing.status, "active");
  if (listing.expiresAt && listing.expiresAt.getTime() <= Date.now()) {
    throw new ConflictError("Listing is past expiry");
  }
  listing.status = "active";
  if (!listing.publishedAt) listing.publishedAt = new Date();
  await listing.save();
  await record(userId, "user", "listing.resume", listing._id.toString(), requestId, { status: "active" });
  return ownerView(listing);
}

export async function renewListing(id: string, userId: string, requestId: string) {
  const listing = await owned(id, userId);
  if (listing.status === "expired") assertTransition("expired", "active");
  else if (listing.status !== "active" && listing.status !== "paused") {
    throw new ConflictError(`Cannot renew a ${listing.status} listing`);
  }
  const base = Math.max(Date.now(), listing.expiresAt?.getTime() ?? 0);
  listing.expiresAt = new Date(base + LIFETIME_MS);
  if (listing.status === "expired") {
    listing.status = "active";
    if (!listing.publishedAt) listing.publishedAt = new Date();
  }
  await listing.save();
  await record(userId, "user", "listing.renew", listing._id.toString(), requestId, { status: listing.status });
  return ownerView(listing);
}

export async function duplicateListing(id: string, userId: string, requestId: string) {
  const listing = await owned(id, userId);
  const copy = await Listing.create({
    ownerId: listing.ownerId,
    status: "draft",
    categoryId: listing.categoryId,
    stateId: listing.stateId,
    cityId: listing.cityId,
    districtId: listing.districtId,
    localityId: listing.localityId,
    title: listing.title,
    description: listing.description,
    attributes: listing.attributes ?? {},
    contact: listing.contact,
    mediaIds: listing.mediaIds ?? [],
    coverMediaId: listing.coverMediaId,
    seoNoindex: true,
  });
  const saved = await load(copy._id.toString());
  await record(userId, "user", "listing.duplicate", saved._id.toString(), requestId, { sourceId: listing._id.toString() });
  return ownerView(saved);
}

export async function removeListing(id: string, userId: string, requestId: string) {
  await move(id, userId, "removed", "listing.remove", requestId);
  return { status: "removed" as const };
}

export async function listVersions(id: string, userId: string, roles: string[]) {
  const listing = await load(id);
  if (listing.ownerId.toString() !== userId && !isStaffRole(roles)) throw new ForbiddenError("Forbidden");
  const versions = await ListingVersion.find({ listingId: listing._id }).sort({ version: 1 });
  return {
    versions: versions.map((version) => ({
      id: version._id.toString(),
      version: version.version,
      snapshot: version.snapshot,
      actorId: version.actorId.toString(),
      createdAt: iso(version.createdAt),
    })),
  };
}

export async function revealContact(
  id: string,
  userId: string | undefined,
  channel: "phone" | "whatsapp" | "telegram" | "form",
  requestId: string,
  ip: string,
) {
  const listing = await load(id);
  if (listing.status === "removed" || listing.status === "deleted") throw new GoneError();
  if (listing.status !== "active") throw new NotFoundError("Not found");
  const max = intEnv("CONTACT_REVEAL_PER_HOUR", 20);
  const ipLimit = await consumeRateLimit(`reveal:ip:${ip || "local"}`, max, REVEAL_WINDOW_MS);
  if (!ipLimit.ok) throw new RevealLimitError(ipLimit.retryAfter);
  if (userId) {
    const userLimit = await consumeRateLimit(`reveal:user:${userId}`, max, REVEAL_WINDOW_MS);
    if (!userLimit.ok) throw new RevealLimitError(userLimit.retryAfter);
  }
  const contact = listing.contact ?? {};
  const expiresAt = new Date(Date.now() + REVEAL_TTL_MS).toISOString();
  let value: string | null = null;
  let deepLink: string | null = null;
  if (channel === "phone") value = contact.phone ?? null;
  if (channel === "whatsapp" && contact.whatsapp) {
    value = contact.whatsapp;
    deepLink = `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`;
  }
  if (channel === "telegram" && contact.telegram) {
    value = contact.telegram;
    deepLink = `https://t.me/${encodeURIComponent(contact.telegram.replace(/^@/, ""))}`;
  }
  if (channel === "form") {
    if (!contact.acceptForm) throw new NotFoundError("Contact is not available");
  } else if (!value) {
    throw new NotFoundError("Contact is not available");
  }
  await record(userId ?? null, "user", "listing.contact_reveal", listing._id.toString(), requestId, { channel }, ip);
  return { value, deepLink, expiresAt };
}

export async function expireDue(requestId: string) {
  await connectDb();
  const due = await Listing.find({ status: "active", expiresAt: { $lte: new Date() } }).select("slug").limit(200).lean<{ slug?: string }[]>();
  const result = await Listing.updateMany(
    { status: "active", expiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } },
  );
  const expired = result.modifiedCount;
  notifyIndexNow(due.flatMap((row) => (row.slug ? [`/ad/${row.slug}/`] : [])));
  await record(null, "system", "listing.expire", "cron", requestId, { expired });
  return { expired };
}

/** Tells IndexNow about changed paths. Shared by publishing and active imports. Never throws. */
export function notifyIndexNow(paths: string[]): Promise<void> {
  if (!paths.length) return Promise.resolve();
  return import("@/server/indexnow/ping")
    .then((mod) => mod.queueIndexNow(paths))
    .catch(() => undefined);
}
