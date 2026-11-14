/** Client-side checks and upload for the create-ad screen. The server repeats every rule. */

export type MediaKind = "image" | "video";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const VIDEO_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_SECONDS = 30;

export const PHOTO_RULE = "Photos must be jpeg, png or webp, up to 8 MB each.";
export const VIDEO_RULE = "Videos must be mp4, webm or mov, up to 10 MB and 30 seconds each.";

/** Length of a video in seconds, read from its metadata. Throws when the browser cannot read the file. */
export function videoSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This video could not be read"));
    };
    video.src = url;
  });
}

/** Returns the reason a file is refused, or null when it may be uploaded. */
export async function refusalFor(file: File, kind: MediaKind): Promise<string | null> {
  if (kind === "image") {
    return PHOTO_TYPES.includes(file.type) && file.size > 0 && file.size <= PHOTO_MAX_BYTES ? null : PHOTO_RULE;
  }
  if (!VIDEO_TYPES.includes(file.type) || file.size > VIDEO_MAX_BYTES) return VIDEO_RULE;
  try {
    const seconds = await videoSeconds(file);
    return Number.isFinite(seconds) && seconds <= VIDEO_MAX_SECONDS ? null : VIDEO_RULE;
  } catch {
    return VIDEO_RULE;
  }
}

export type UploadOutcome = { ok: true; mediaId: string } | { ok: false; error: string };

/** Sends one file to the staff upload route. `ownerEmail` is blank for the staff account itself. */
export async function uploadAdMedia(file: File, kind: MediaKind, ownerEmail: string): Promise<UploadOutcome> {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  form.set("ownerEmail", ownerEmail);
  try {
    const res = await fetch("/admin/ads/photos/", { method: "POST", body: form, credentials: "same-origin" });
    const body = (await res.json()) as { ok: boolean; mediaId?: string; error?: string };
    if (body.ok && body.mediaId) return { ok: true, mediaId: body.mediaId };
    return { ok: false, error: body.error || "Upload failed" };
  } catch {
    return { ok: false, error: "Connection problem. Remove this file and add it again." };
  }
}
