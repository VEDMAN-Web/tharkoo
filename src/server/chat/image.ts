import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { PolicyViolationError } from "@/server/http";
import { uploadToCloudinary } from "@/server/media/client";
import { CLOUDINARY_FOLDER, UPLOAD_NEEDS_CLOUDINARY, onVercel, optionalCloudinary } from "@/server/media/config";

export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const RULE = "Photos in chat must be jpeg, png or webp, up to 5 MB";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** The file must really be the type it claims, so a renamed file cannot slip through. */
export function imageMatchesType(data: Buffer, type: string) {
  if (type === "image/jpeg") return data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (type === "image/png") return data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return data.length > 12 && data.toString("latin1", 0, 4) === "RIFF" && data.toString("latin1", 8, 12) === "WEBP";
  return false;
}

/**
 * Stores a chat photo through the same adapter as ad photos: Cloudinary when it is configured,
 * otherwise public/uploads (names are 24 hex characters, served by /uploads/[file]).
 */
export async function storeChatImage(file: { type: string; data: Buffer }): Promise<string> {
  const ext = EXT[file.type];
  if (!ext || file.data.length === 0 || file.data.length > CHAT_IMAGE_MAX_BYTES || !imageMatchesType(file.data, file.type)) {
    throw new PolicyViolationError(RULE);
  }
  const id = new mongoose.Types.ObjectId().toString();
  if (optionalCloudinary()) {
    const uploaded = await uploadToCloudinary(file.data, { contentType: file.type, folder: `${CLOUDINARY_FOLDER}/chat`, publicId: id });
    return uploaded.url;
  }
  if (onVercel()) throw new PolicyViolationError(UPLOAD_NEEDS_CLOUDINARY);
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${id}.${ext}`), file.data);
  return `/uploads/${id}.${ext}`;
}
