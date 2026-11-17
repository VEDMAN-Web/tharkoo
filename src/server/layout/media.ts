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
import { SiteMedia, User } from "@/server/models";
import type { SiteMediaDoc } from "@/server/models/layout";
import { findMediaUsages, mediaUsageCounts, type MediaUsage } from "@/server/layout/media-refs";
import { textDenied } from "@/server/shared/policy";
import { altFromFileName } from "@/server/media/alt-from-filename";

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

export function present(doc: SiteMediaDoc & { _id: unknown }) {
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
    autoAlt: doc.altAuto === true,
    missingAlt: !doc.alt || doc.alt.trim().length < ALT_MIN || doc.altAuto === true,
    phoneVariantId: doc.phoneVariantId ? String(doc.phoneVariantId) : null,
    focusX: doc.focusX ?? 50,
    focusY: doc.focusY ?? 50,
    trashedAt: doc.trashedAt ? new Date(doc.trashedAt).toISOString() : null,
    purgeAfter: doc.purgeAfter ? new Date(doc.purgeAfter).toISOString() : null,
  };
}

export type MediaItem = ReturnType<typeof present>;

/* ---- usage ---- */

/** Every block, category and place that uses this image (the registry lives in media-refs.ts). */
export async function findUsages(assetId: string): Promise<MediaUsage[]> {
  return findMediaUsages(assetId);
}

function describeUsage(usages: MediaUsage[]) {
  const places = [
    ...new Set(
      usages.map((use) =>
        use.kind === "page"
          ? `${use.key} page${use.scope === "default" ? "" : ` (${use.scope})`}, ${use.where}`
          : `the ${use.kind === "category" ? "category" : "place"} ${use.label || use.key} (${use.blockId})`,
      ),
    ),
  ];
  return places.slice(0, 4).join("; ") + (places.length > 4 ? ` and ${places.length - 4} more` : "");
}

/** The refusal when an image is still in use. A Home page hero banner gets its own wording (H6.13). */
export function inUseMessage(usages: MediaUsage[]) {
  if (usages.every((use) => use.kind === "page" && use.key === "home" && use.blockType === "hero")) {
    return "This image is still used by the Home page hero. Remove it from the Home page hero first.";
  }
  return `This image is still used: ${describeUsage(usages)}. Remove it from those places first.`;
}

/* ---- operations ---- */

export async function uploadSiteMedia(input: {
  file: { type: string; data: Buffer };
  /** Alt text as typed. Empty with `autoAlt` means: fill it from `fileName`. */
  alt: unknown;
  fileName?: string;
  autoAlt?: boolean;
  tags?: unknown;
  email: string;
  roles: string[];
}) {
  requireAdmin(input.roles);
  const { file } = input;
  if (!isSiteMediaType(file.type)) throw new ValidationError("Only jpeg, png and webp images are allowed");
  if (file.data.length === 0) throw new ValidationError("The file is empty");
  if (file.data.length > SITE_MEDIA_MAX_BYTES) throw new ValidationError("Images can be at most 8 MB");
  const typedAlt = typeof input.alt === "string" ? input.alt.trim() : "";
  const autoAlt = input.autoAlt === true && typedAlt === "";
  const alt = validateAlt(autoAlt ? altFromFileName(input.fileName ?? "") : input.alt);
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
    altAuto: autoAlt,
  });
  const item = present(doc.toObject() as SiteMediaDoc & { _id: unknown });
  await record("media.site.upload", input.email, item.id, null, { url: item.url, alt, tags, bytes: item.bytes, autoAlt });
  return item;
}

const UNUSED_SCAN_LIMIT = 5000;

export interface MediaFilter {
  q?: string;
  tag?: string;
  missingAlt?: boolean;
  oversize?: boolean;
  unused?: boolean;
  /** Only the images in the Trash (H8.45). Without it the Trash is left out. */
  trash?: boolean;
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
  // An auto alt (from the file name) counts as missing until someone checks it and saves the card.
  if (filter.missingAlt) and.push({ $or: [{ alt: "" }, { alt: { $regex: `^.{0,${ALT_MIN - 1}}$` } }, { altAuto: true }] });
  if (filter.oversize) query.bytes = { $gt: SITE_MEDIA_OVERSIZE_BYTES };
  query.trashedAt = filter.trash ? { $ne: null } : null;
  if (and.length) query.$and = and;
  const limit = Math.min(Math.max(filter.limit ?? 48, 1), 200);
  const skip = Math.max(filter.skip ?? 0, 0);
  if (filter.unused) {
    // The unused ones are found over the whole library first, so paging and the total are right (capped at 5,000 pictures).
    const all = await SiteMedia.find(query).sort({ createdAt: -1 }).select("_id").limit(UNUSED_SCAN_LIMIT).lean<{ _id: Types.ObjectId }[]>();
    const used = await mediaUsageCounts(all.map((row) => String(row._id)));
    const unusedIds = all.map((row) => row._id).filter((id) => !used.has(String(id)));
    const byId = new Map((await SiteMedia.find({ _id: { $in: unusedIds.slice(skip, skip + limit) } }).lean()).map((row) => [String(row._id), row]));
    const page = unusedIds.slice(skip, skip + limit).flatMap((id) => (byId.has(String(id)) ? [byId.get(String(id))!] : []));
    return { total: unusedIds.length, items: page.map((row) => ({ ...present(row as SiteMediaDoc & { _id: unknown }), used: false, usedIn: 0 })) };
  }
  const rows = await SiteMedia.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  const usage = await mediaUsageCounts(rows.map((row) => String(row._id)));
  const total = await SiteMedia.countDocuments(query);
  return {
    total,
    items: rows.map((row) => ({ ...present(row as SiteMediaDoc & { _id: unknown }), used: usage.has(String(row._id)), usedIn: usage.get(String(row._id)) ?? 0 })),
  };
}

export async function updateSiteMedia(id: string, patch: { alt?: unknown; tags?: unknown }, email: string, roles: string[]) {
  requireAdmin(roles);
  if (!isValidObjectId(id)) throw new NotFoundError("Image not found");
  await connectDb();
  const current = await SiteMedia.findById(id);
  if (!current) throw new NotFoundError("Image not found");
  const before = { alt: current.alt, tags: current.tags };
  if (patch.alt !== undefined) {
    current.alt = validateAlt(patch.alt);
    current.altAuto = false;
  }
  if (patch.tags !== undefined) current.tags = cleanTags(patch.tags);
  await current.save();
  await record("media.site.update", email, id, before, { alt: current.alt, tags: current.tags });
  return present(current.toObject() as SiteMediaDoc & { _id: unknown });
}

/** Removes the stored file of an image (Cloudinary or the local uploads folder). The database row is the caller's job. */
export async function removeStoredFile(objectKey: string) {
  if (objectKey.startsWith(`${CLOUDINARY_FOLDER}/`)) {
    await cloudinaryClient().destroy(objectKey, "upload");
  } else {
    await unlink(path.join(siteMediaDir(), path.basename(objectKey))).catch(() => undefined);
  }
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
  await removeStoredFile(current.objectKey);
  await record("media.site.delete", email, id, { url: current.url, alt: current.alt }, null);
  return { id };
}
