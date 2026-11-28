import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import sharp from "sharp";
import { connectDb } from "@/lib/db";
import { AVATAR_MAX_BYTES, AVATAR_RULE, AVATAR_SIZE, AVATAR_TYPES } from "@/lib/ui/avatar";
import { imageMatchesType } from "@/server/chat/image";
import { ConflictError, ValidationError } from "@/server/http";
import { cloudinaryClient, uploadToCloudinary } from "@/server/media/client";
import { CLOUDINARY_FOLDER, UPLOAD_NEEDS_CLOUDINARY, onVercel, optionalCloudinary } from "@/server/media/config";
import { csamScannerFromEnv } from "@/server/media/csam";
import { User } from "@/server/models";

const UNREADABLE = "This photo could not be read. Try another one.";

/** Square crop, turned the right way up, WebP. Camera details, such as where a photo was taken, are not kept. */
export async function compressAvatar(data: Buffer): Promise<Buffer> {
  try {
    return await sharp(data, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new ValidationError(UNREADABLE);
  }
}

/** Removes a stored photo. A file that cannot be removed is logged and left: it must not stop the person's change. */
async function removeStored(key: string | undefined) {
  if (!key) return;
  try {
    if (key.startsWith("/uploads/")) await unlink(path.join(process.cwd(), "public", "uploads", path.basename(key)));
    else if (optionalCloudinary()) await cloudinaryClient().destroy(key, "upload");
  } catch (error) {
    console.error("old profile photo could not be removed", error);
  }
}

async function store(webp: Buffer): Promise<{ url: string; key: string }> {
  // A new name every time, so a changed photo is never served from an old cache.
  const id = new mongoose.Types.ObjectId().toString();
  if (optionalCloudinary()) {
    const stored = await uploadToCloudinary(webp, { contentType: "image/webp", folder: `${CLOUDINARY_FOLDER}/avatars`, publicId: id });
    return { url: stored.url, key: stored.publicId };
  }
  if (onVercel()) throw new ConflictError(UPLOAD_NEEDS_CLOUDINARY);
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${id}.webp`), webp);
  return { url: `/uploads/${id}.webp`, key: `/uploads/${id}.webp` };
}

/** Saves the signed-in person's profile photo and removes the one it replaces. */
export async function saveAvatar(userId: string, file: { type: string; data: Buffer }) {
  await connectDb();
  if (!AVATAR_TYPES.includes(file.type) || file.data.length === 0 || file.data.length > AVATAR_MAX_BYTES || !imageMatchesType(file.data, file.type)) {
    throw new ValidationError(AVATAR_RULE);
  }
  const webp = await compressAvatar(file.data);
  // The same safety scan as other uploaded pictures, before it is stored.
  const scan = await csamScannerFromEnv().scan({ objectKey: `avatar:${userId}`, contentType: "image/webp", bytes: webp.length });
  if (scan.match) throw new ValidationError("Upload was rejected");
  const saved = await store(webp);
  const before = await User.findByIdAndUpdate(userId, { $set: { avatarUrl: saved.url, avatarKey: saved.key } })
    .select("avatarKey")
    .lean<{ avatarKey?: string } | null>();
  await removeStored(before?.avatarKey);
  return { avatarUrl: saved.url as string | null };
}

/** Goes back to the letter: the photo is taken off the account and its file is removed. */
export async function removeAvatar(userId: string) {
  await connectDb();
  const before = await User.findByIdAndUpdate(userId, { $unset: { avatarUrl: 1, avatarKey: 1 } })
    .select("avatarKey")
    .lean<{ avatarKey?: string } | null>();
  await removeStored(before?.avatarKey);
  return { avatarUrl: null as string | null };
}
