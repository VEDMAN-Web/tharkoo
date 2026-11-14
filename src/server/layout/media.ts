import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Types, isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { cloudinaryClient, uploadToCloudinary } from "@/server/media/client";
import { CLOUDINARY_FOLDER, UPLOAD_NEEDS_CLOUDINARY, optionalCloudinary, uploadsAvailable } from "@/server/media/config";
import { PageLayout, SiteMedia, User } from "@/server/models";
import type { BlockBase, SiteMediaDoc } from "@/server/models/layout";
import { textDenied } from "@/server/shared/policy";

const audit = new AuditRepository();

/** Upload limit for staff images (H6.13: 8 MB; the editors say "2 MB or less loads faster"). */
export const SITE_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
/** Files above this size are listed under "Oversize" so they can be replaced with a lighter copy. */
export const SITE_MEDIA_OVERSIZE_BYTES = 500 * 1024;
export const ALT_MIN = 3;
export const ALT_MAX = 125;
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type SiteMediaType = keyof typeof TYPES;

export function isSiteMediaType(value: string): value is SiteMediaType {
  return Object.prototype.hasOwnProperty.call(TYPES, value);
}

/**
 * Folder for staff images. Files are named like listing photos (24 hex characters), so the existing `/uploads/[file]`
 * route serves them even though they are written after the build. Tests point `SITE_MEDIA_DIR` at a temp folder.
 */
export function siteMediaDir() {
  return process.env.SITE_MEDIA_DIR?.trim() || path.join(process.cwd(), "public", "uploads");
}

function requireAdmin(roles: string[]) {
  if (!isAdminRole(roles)) throw new ForbiddenError("Only an admin can manage the media library");
}

async function actorId(email: string) {
  if (!email) return null;
  const user = await User.findOne({ email }).select("_id");
  return user?._id?.toString() ?? null;
}

async function record(action: string, email: string, targetId: string, before: unknown, after: unknown) {
  await audit.append({
    actorId: await actorId(email),
    actorType: "admin",
    action,
    targetType: "site_media",
    targetId,
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    requestId: randomUUID(),
  });
}

/* ---- file checks (the declared type must match the real bytes) ---- */

/** Reads width and height from the file header. Returns null when the bytes are not that image type. */
export function readImageSize(data: Buffer, type: SiteMediaType): { width: number; height: number } | null {
  try {
    if (type === "image/png") {
      if (data.length < 24 || data.readUInt32BE(0) !== 0x89504e47 || data.readUInt32BE(4) !== 0x0d0a1a0a) return null;
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    }
    if (type === "image/jpeg") {
      if (data.length < 4 || data.readUInt16BE(0) !== 0xffd8) return null;
      let offset = 2;
      while (offset + 9 < data.length) {
        if (data[offset] !== 0xff) return null;
        const marker = data[offset + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
        }
        offset += 2 + data.readUInt16BE(offset + 2);
      }
      return null;
    }
    if (data.length < 30 || data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") return null;
    const chunk = data.toString("ascii", 12, 16);
    if (chunk === "VP8 ") return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = data.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
    return null;
  } catch {
    return null;
  }
}

export function validateAlt(value: unknown): string {
  const alt = typeof value === "string" ? value.trim() : "";
  if (alt.length < ALT_MIN) throw new ValidationError(`Alt text is required (at least ${ALT_MIN} characters). Describe what the image shows.`);
  if (alt.length > ALT_MAX) throw new ValidationError(`Alt text can be at most ${ALT_MAX} characters`);
  if (textDenied(alt).denied) throw new ValidationError("The alt text contains a term that is not allowed on Tharkoo");
  return alt;
}

export function cleanTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const tags = raw
    .map((tag) => String(tag).trim().toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/\s+/g, "-").slice(0, 30))
    .filter(Boolean);
  if (tags.length > 10) throw new ValidationError("Use at most 10 tags");
  for (const tag of tags) if (textDenied(tag).denied) throw new ValidationError("A tag contains a term that is not allowed");
  return [...new Set(tags)];
}

/** Public shape of one media item, as blocks store it (`assetId`, `src`, `alt`, size). */
export function toImageRef(doc: Pick<SiteMediaDoc, "url" | "alt" | "width" | "height"> & { _id?: unknown }) {
  return { assetId: String(doc._id), src: doc.url, alt: doc.alt, width: doc.width, height: doc.height };
}

function present(doc: SiteMediaDoc & { _id: unknown }) {
  return {
    id: String(doc._id),
    url: doc.url,
    alt: doc.alt,
    width: doc.width,
    height: doc.height,
    bytes: doc.bytes,
    contentType: doc.contentType,
    tags: doc.tags ?? [],
    uploadedBy: doc.uploadedBy,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    oversize: doc.bytes > SITE_MEDIA_OVERSIZE_BYTES,
    missingAlt: !doc.alt || doc.alt.trim().length < ALT_MIN,
  };
}

export type MediaItem = ReturnType<typeof present>;

/* ---- usage ---- */

export interface MediaUsage {
  key: string;
  scope: string;
  where: "draft" | "published";
  blockId: string;
  blockType: string;
}

function mentions(value: unknown, assetId: string): boolean {
  if (Array.isArray(value)) return value.some((item) => mentions(item, assetId));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.assetId === assetId) return true;
    return Object.values(record).some((item) => mentions(item, assetId));
  }
  return false;
}

function usagesIn(blocks: BlockBase[] | undefined, assetId: string) {
  return (blocks ?? []).filter((block) => mentions(block.props, assetId));
}

/** Every draft or published block that uses this image. */
export async function findUsages(assetId: string): Promise<MediaUsage[]> {
  await connectDb();
  const docs = await PageLayout.find({}).lean();
  const out: MediaUsage[] = [];
  for (const doc of docs) {
    for (const [where, blocks] of [["draft", doc.draft], ["published", doc.published]] as const) {
      for (const block of usagesIn(blocks as BlockBase[], assetId)) {
        out.push({ key: doc.key, scope: doc.scope, where, blockId: block.id, blockType: block.type });
      }
    }
  }
  return out;
}

function describeUsage(usages: MediaUsage[]) {
  const places = [...new Set(usages.map((use) => `${use.key} page${use.scope === "default" ? "" : ` (${use.scope})`}, ${use.where}`))];
  return places.slice(0, 4).join("; ") + (places.length > 4 ? ` and ${places.length - 4} more` : "");
}

/** The refusal when an image is still in use. A Home page hero banner gets its own wording (H6.13). */
function inUseMessage(usages: MediaUsage[]) {
  if (usages.every((use) => use.key === "home" && use.blockType === "hero")) {
    return "This image is still used by the Home page hero. Remove it from the Home page hero first.";
  }
  return `This image is still used: ${describeUsage(usages)}. Remove it from those blocks first.`;
}

/* ---- operations ---- */

export async function uploadSiteMedia(input: {
  file: { type: string; data: Buffer };
  alt: unknown;
  tags?: unknown;
  email: string;
  roles: string[];
}) {
  requireAdmin(input.roles);
  const { file } = input;
  if (!isSiteMediaType(file.type)) throw new ValidationError("Only jpeg, png and webp images are allowed");
  if (file.data.length === 0) throw new ValidationError("The file is empty");
  if (file.data.length > SITE_MEDIA_MAX_BYTES) throw new ValidationError("Images can be at most 8 MB");
  const alt = validateAlt(input.alt);
  const tags = cleanTags(input.tags);
  const size = readImageSize(file.data, file.type);
  if (!size || size.width < 1 || size.height < 1) throw new ValidationError("This file is not a valid jpeg, png or webp image");
  if (!uploadsAvailable()) throw new ConflictError(`${UPLOAD_NEEDS_CLOUDINARY}. Add the Cloudinary settings, then try again.`);
  await connectDb();
  const id = new Types.ObjectId().toHexString();
  const name = `${id}.${TYPES[file.type]}`;
  let url = `/uploads/${name}`;
  let objectKey = `site/${name}`;
  if (optionalCloudinary()) {
    const stored = await uploadToCloudinary(file.data, { contentType: file.type, folder: `${CLOUDINARY_FOLDER}/site`, publicId: id });
    url = stored.url;
    objectKey = stored.publicId;
  } else {
    const dir = siteMediaDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), file.data);
  }
  const doc = await SiteMedia.create({
    url,
    objectKey,
    alt,
    width: size.width,
    height: size.height,
    bytes: file.data.length,
    contentType: file.type,
    tags,
    uploadedBy: input.email,
  });
  const item = present(doc.toObject() as SiteMediaDoc & { _id: unknown });
  await record("media.site.upload", input.email, item.id, null, { url: item.url, alt, tags, bytes: item.bytes });
  return item;
}

export interface MediaFilter {
  q?: string;
  tag?: string;
  missingAlt?: boolean;
  oversize?: boolean;
  unused?: boolean;
  limit?: number;
  skip?: number;
}

export async function listSiteMedia(filter: MediaFilter, roles: string[]) {
  requireAdmin(roles);
  await connectDb();
  const query: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];
  const q = (filter.q ?? "").trim().slice(0, 80);
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    and.push({ $or: [{ alt: rx }, { tags: rx }, { objectKey: rx }] });
  }
  if (filter.tag) query.tags = filter.tag.toLowerCase();
  if (filter.missingAlt) and.push({ $or: [{ alt: "" }, { alt: { $regex: `^.{0,${ALT_MIN - 1}}$` } }] });
  if (filter.oversize) query.bytes = { $gt: SITE_MEDIA_OVERSIZE_BYTES };
  if (and.length) query.$and = and;
  const limit = Math.min(Math.max(filter.limit ?? 48, 1), 200);
  const skip = Math.max(filter.skip ?? 0, 0);
  let rows = await SiteMedia.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  let usedIds: Set<string> | null = null;
  if (filter.unused || rows.length) {
    usedIds = new Set();
    const layouts = await PageLayout.find({}).lean();
    for (const row of rows) {
      const id = String(row._id);
      if (layouts.some((layout) => mentions(layout.draft, id) || mentions(layout.published, id))) usedIds.add(id);
    }
  }
  if (filter.unused) rows = rows.filter((row) => !usedIds!.has(String(row._id)));
  const total = await SiteMedia.countDocuments(query);
  return {
    total,
    items: rows.map((row) => ({ ...present(row as SiteMediaDoc & { _id: unknown }), used: usedIds!.has(String(row._id)) })),
  };
}

export async function updateSiteMedia(id: string, patch: { alt?: unknown; tags?: unknown }, email: string, roles: string[]) {
  requireAdmin(roles);
  if (!isValidObjectId(id)) throw new NotFoundError("Image not found");
  await connectDb();
  const current = await SiteMedia.findById(id);
  if (!current) throw new NotFoundError("Image not found");
  const before = { alt: current.alt, tags: current.tags };
  if (patch.alt !== undefined) current.alt = validateAlt(patch.alt);
  if (patch.tags !== undefined) current.tags = cleanTags(patch.tags);
  await current.save();
  await record("media.site.update", email, id, before, { alt: current.alt, tags: current.tags });
  return present(current.toObject() as SiteMediaDoc & { _id: unknown });
}

/** Deleting is refused while a published or draft block still uses the image; the message says where. */
export async function deleteSiteMedia(id: string, email: string, roles: string[]) {
  requireAdmin(roles);
  if (!isValidObjectId(id)) throw new NotFoundError("Image not found");
  await connectDb();
  const current = await SiteMedia.findById(id);
  if (!current) throw new NotFoundError("Image not found");
  const usages = await findUsages(id);
  if (usages.length) throw new ConflictError(inUseMessage(usages));
  await SiteMedia.deleteOne({ _id: id });
  if (current.objectKey.startsWith(`${CLOUDINARY_FOLDER}/`)) {
    await cloudinaryClient().destroy(current.objectKey, "upload");
  } else {
    await unlink(path.join(siteMediaDir(), path.basename(current.objectKey))).catch(() => undefined);
  }
  await record("media.site.delete", email, id, { url: current.url, alt: current.alt }, null);
  return { id };
}
