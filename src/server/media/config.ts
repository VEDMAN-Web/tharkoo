import { InternalError } from "@/server/http";

const ENV_NAMES = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_FOLDER_PREFIX"] as const;

export interface CloudinaryEnv {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folderPrefix: string;
}

export const MAX_BYTES = 8 * 1024 * 1024;
export const ID_URL_TTL_SECONDS = 120;
export const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
export const STRIP_EXIF = "fl_strip_profile";
/** card 480w, detail 1280w, thumb. f_auto,q_auto and an EXIF strip on each. */
export const EAGER = ["c_limit,w_480", "c_limit,w_1280", "c_thumb,w_200,h_200"]
  .map((crop) => `${crop},f_auto,q_auto,${STRIP_EXIF}`)
  .join("|");

export function cloudinaryEnv(): CloudinaryEnv {
  const missing = ENV_NAMES.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) throw new InternalError(`Cloudinary is not configured (${missing.join(", ")})`);
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
    apiKey: process.env.CLOUDINARY_API_KEY!.trim(),
    apiSecret: process.env.CLOUDINARY_API_SECRET!.trim(),
    folderPrefix: process.env.CLOUDINARY_FOLDER_PREFIX!.trim().replace(/^\/+|\/+$/g, ""),
  };
}

/** Free listings default to 1 photo. A promoted listing defaults to 10. */
export function photoLimit(promoted: boolean) {
  const raw = process.env[promoted ? "LISTING_PHOTO_LIMIT_PROMOTED" : "LISTING_PHOTO_LIMIT_FREE"];
  const parsed = raw?.trim() ? Number(raw) : Number.NaN;
  if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  return promoted ? 10 : 1;
}
