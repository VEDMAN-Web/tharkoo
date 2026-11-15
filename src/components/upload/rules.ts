/**
 * H7.8: one config per upload box. The info line, the (i) popover and the per-file messages all come from here,
 * so every uploader says the same thing. Server checks stay where they are; these are the words shown to people.
 */

export type UploadRule = {
  /** Plain word for one file in messages: "photo", "video" or "image". */
  noun: "photo" | "video" | "image";
  /** MIME types the box accepts. */
  accept: readonly string[];
  /** Plain words for the formats, e.g. "JPG, PNG or WEBP". */
  formats: string;
  maxBytes: number;
  /** Longest video in seconds, where the field takes video. */
  maxSeconds?: number;
  /** The one info line under the box, shown before anyone picks a file. */
  line: string;
  /** Rows for the (i) popover. */
  details: readonly string[];
};

const MB = 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

/** A single photo, JPG, PNG or WEBP. Used by every photo box that is not a logo. */
const PHOTO_BASE = { noun: "photo", accept: PHOTO_TYPES, formats: "JPG, PNG or WEBP", maxBytes: 8 * MB } as const;

export const UPLOAD_RULES = {
  adPhotos: {
    ...PHOTO_BASE,
    line: "Up to 10 photos and videos. Photos: JPG, PNG or WEBP, up to 8 MB, best 1200 x 1500 px (tall).",
    details: ["Formats: JPG, PNG or WEBP.", "Up to 8 MB per photo.", "Best size: 1200 x 1500 px (tall).", "Up to 10 photos and videos in total.", "Photos get a tharkoo.com watermark."],
  },
  adVideos: {
    noun: "video",
    accept: VIDEO_TYPES,
    formats: "MP4, MOV or WEBM",
    maxBytes: 10 * MB,
    maxSeconds: 30,
    line: "MP4, MOV or WEBM, up to 10 MB and 30 seconds.",
    details: ["Formats: MP4, MOV or WEBM.", "Up to 10 MB per video.", "Up to 30 seconds per video.", "Videos count toward the 10 photos and videos."],
  },
  categoryBand: {
    ...PHOTO_BASE,
    line: "1600 x 500 px for computers, 800 x 1000 px for phones, up to 8 MB.",
    details: ["Formats: JPG, PNG or WEBP.", "Computers: 1600 x 500 px.", "Phones: 800 x 1000 px.", "Up to 8 MB."],
  },
  homeBanner: {
    ...PHOTO_BASE,
    line: "1920 x 700 px for computers, 900 x 1200 px for phones.",
    details: ["Formats: JPG, PNG or WEBP.", "Computers: 1920 x 700 px.", "Phones: 900 x 1200 px. Shown below 600 px wide.", "Up to 8 MB each."],
  },
  categoryCard: {
    ...PHOTO_BASE,
    line: "1200 x 800 px (3:2), phone crop 4:5.",
    details: ["Formats: JPG, PNG or WEBP.", "Best size: 1200 x 800 px (3:2).", "Phones crop to 4:5, so keep the subject in the middle.", "Up to 8 MB."],
  },
  blockImage: {
    ...PHOTO_BASE,
    line: "JPG, PNG or WEBP, up to 8 MB.",
    details: ["Formats: JPG, PNG or WEBP.", "Up to 8 MB.", "Add alt text so screen readers can describe the picture."],
  },
  logo: {
    noun: "image",
    accept: ["image/png"],
    formats: "PNG",
    maxBytes: 8 * MB,
    line: "Square PNG, 512 x 512 px.",
    details: ["Format: PNG only.", "Square, 512 x 512 px.", "Up to 8 MB."],
  },
} as const satisfies Record<string, UploadRule>;

export type UploadRuleId = keyof typeof UPLOAD_RULES;

/** "8 MB", "1.5 MB": the size word used in messages. */
export function megabytes(bytes: number): string {
  const value = bytes / MB;
  return `${value >= 10 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)} MB`;
}

/** The reason one file cannot be uploaded to this box, or null when the type and size are fine. Length is checked by `videoProblem`. */
export function fileProblem(file: { name: string; type: string; size: number }, rule: UploadRule): string | null {
  if (!rule.accept.includes(file.type)) return `This ${rule.noun} is not ${rule.formats} (${file.name}).`;
  if (file.size <= 0) return `This ${rule.noun} is empty (${file.name}).`;
  if (file.size > rule.maxBytes) return `This ${rule.noun} is ${megabytes(file.size)}. The limit is ${megabytes(rule.maxBytes)}.`;
  return null;
}

/** The reason a video is too long, or null. `seconds` is NaN when the browser cannot read the clip. */
export function videoProblem(seconds: number, rule: UploadRule): string | null {
  if (!rule.maxSeconds) return null;
  if (!Number.isFinite(seconds) || seconds <= 0) return `This video could not be read. ${rule.line}`;
  if (seconds > rule.maxSeconds) return `This video is ${Math.round(seconds)} seconds. The limit is ${rule.maxSeconds} seconds.`;
  return null;
}

/** Returns a copy of the list with one item moved by `step` places (clamped to the ends). */
export function moveItem<T>(items: readonly T[], from: number, step: number): T[] {
  const to = Math.min(items.length - 1, Math.max(0, from + step));
  if (from < 0 || from >= items.length || to === from) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
