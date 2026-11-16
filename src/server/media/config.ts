import { InternalError } from "@/server/http";

const ENV_NAMES = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const;

export interface CloudinaryEnv {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folderPrefix: string;
}

/** Every Cloudinary upload goes under this folder. It is fixed, not an env var. */
export const CLOUDINARY_FOLDER = "tharkoo";
export const UPLOAD_NEEDS_CLOUDINARY = "Image upload needs Cloudinary on this server";

/** True on Vercel, where the disk is read-only, so uploads cannot fall back to local files. */
export function onVercel() {
  return Boolean(process.env.VERCEL?.trim());
}

/** Whether an upload can be stored here: Cloudinary is configured, or we are not on Vercel (local disk, dev). */
export function uploadsAvailable() {
  return optionalCloudinary() !== null || !onVercel();
}

export const MAX_BYTES = 8 * 1024 * 1024;
export const ID_URL_TTL_SECONDS = 120;
export const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
export const STRIP_EXIF = "fl_strip_profile";
/** card 480w, detail 1280w, thumb. f_auto,q_auto and an EXIF strip on each. */
export const EAGER = ["c_limit,w_480", "c_limit,w_1280", "c_thumb,w_200,h_200"]
  .map((crop) => `${crop},f_auto,q_auto,${STRIP_EXIF}`)
  .join("|");

export function optionalCloudinary(): CloudinaryEnv | null {
  const missing = ENV_NAMES.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) return null;
  return cloudinaryEnv();
}

export function cloudinaryEnv(): CloudinaryEnv {
  const missing = ENV_NAMES.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) throw new InternalError(`Cloudinary is not configured (${missing.join(", ")})`);
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
    apiKey: process.env.CLOUDINARY_API_KEY!.trim(),
    apiSecret: process.env.CLOUDINARY_API_SECRET!.trim(),
    folderPrefix: CLOUDINARY_FOLDER,
  };
}

/** H6.18: one limit for every ad. Photos and videos together, for free, promoted, admin Create ad and partner import. */
export const AD_MEDIA_MAX = 10;
/** Shown when an ad would hold more than AD_MEDIA_MAX photos and videos. */
export const AD_MEDIA_LIMIT_MESSAGE = `An ad can have up to ${AD_MEDIA_MAX} photos and videos in total`;

/**
 * Kept so callers outside H6.18 still compile. Every ad has the same limit (AD_MEDIA_MAX), whatever the plan.
 * New code should use AD_MEDIA_MAX.
 */
export function photoLimit(_promoted?: boolean) {
  return AD_MEDIA_MAX;
}

/** A partner import row: the category maximum is an upper bound, and never above AD_MEDIA_MAX. */
export function importPhotoLimit(categoryMax?: number | null) {
  return Number.isInteger(categoryMax) && (categoryMax as number) >= 1 ? Math.min(categoryMax as number, AD_MEDIA_MAX) : AD_MEDIA_MAX;
}

/** Media rows that no longer count against an ad's limit (deleted, failed or refused). */
export const CLOSED_MEDIA_STATUSES = ["deleted", "failed", "rejected_policy", "rejected_csam"] as const;

/** Ad videos ("reels"): mp4, webm or mov, 10 MB and 30 seconds each. They count with the photos toward AD_MEDIA_MAX. */
export const VIDEO_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 30;
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const VIDEO_FORMAT_MIME: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
export const VIDEO_RULE_LINE = "Videos: max 10 MB and 30 seconds each. Photos and videos: up to 10 in total.";
/** Member ad videos (post-ad): mp4, webm or mov, 100 MB and 60 seconds each. Imports and admin Create ad keep the limits above. */
export const AD_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const AD_VIDEO_MAX_SECONDS = 60;
/** Cloudinary makes a 720p mp4 of every member video, so playback stays light. The same string is used on delivery. */
export const AD_VIDEO_EAGER = "c_limit,h_720,w_1280,f_mp4,q_auto";
export const AD_VIDEO_RULE_LINE = `Videos: max ${AD_VIDEO_MAX_BYTES / 1024 / 1024} MB and ${AD_VIDEO_MAX_SECONDS} seconds each. Photos and videos: up to 10 in total.`;
export const AD_VIDEO_RULE_MESSAGE = `Videos must be mp4, webm or mov, up to ${AD_VIDEO_MAX_BYTES / 1024 / 1024} MB and ${AD_VIDEO_MAX_SECONDS} seconds each`;
export const AD_VIDEO_BAD_TYPE = "Use an mp4, webm or mov video.";
export const AD_VIDEO_TOO_BIG = `This file is too big (max ${AD_VIDEO_MAX_BYTES / 1024 / 1024} MB).`;
export const AD_VIDEO_TOO_LONG = `This video is longer than ${AD_VIDEO_MAX_SECONDS} seconds.`;
export const AD_VIDEO_UNREADABLE = "This video could not be read. Try another file.";
export const AD_VIDEO_NEEDS_DRAFT = "Save the ad details first, then add the video.";
/** An ad's videos are hidden once this many different people have an open report on them. */
export const VIDEO_HIDE_REPORTS = 3;
export const VIDEO_RULE_MESSAGE = "Videos must be mp4, webm or mov, up to 10 MB and 30 seconds each";
