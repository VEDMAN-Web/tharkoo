import { api, friendlyError } from "@/lib/ui/api";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_RULE_NOTE = "Use a JPG, PNG, or WebP photo up to 8 MB.";
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const VIDEO_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 30;
export const VIDEO_MAX_PER_AD = 2;
export const VIDEO_RULE_NOTE = "Use an mp4, webm or mov video up to 10 MB and 30 seconds.";

type Signed = {
  uploadUrl: string;
  mediaId: string;
  apiKey?: string;
  timestamp?: number;
  signature?: string;
  folder?: string;
  params?: Record<string, string | number>;
};

/** Checks a photo before anything is sent. Returns the note to show, or null when it is fine. */
export function checkPhoto(file: File): string | null {
  return PHOTO_TYPES.includes(file.type) && file.size <= PHOTO_MAX_BYTES ? null : PHOTO_RULE_NOTE;
}

/** Reads the clip length in the browser. NaN when the browser cannot read the file. */
function clipSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (value: number) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : Number.NaN);
    video.onerror = () => done(Number.NaN);
    video.src = url;
  });
}

/** Checks a video's type, size and length before anything is sent. */
export async function checkVideo(file: File): Promise<string | null> {
  if (!VIDEO_TYPES.includes(file.type) || file.size > VIDEO_MAX_BYTES) return VIDEO_RULE_NOTE;
  const seconds = await clipSeconds(file);
  return seconds > 0 && seconds <= VIDEO_MAX_SECONDS ? null : VIDEO_RULE_NOTE;
}

/** POSTs a form and reports the upload share as it goes. Resolves true on a 2xx answer. */
export function postWithProgress(url: string, body: FormData, onProgress: (ratio: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(body);
  });
}

type UploadResult = { ok: true; mediaId: string } | { ok: false; error: string };

/**
 * Signs, sends and (on Cloudinary) completes one photo or video for a draft.
 * Local storage answers the send directly; Cloudinary needs the completion call after the send.
 */
export async function uploadMedia(options: {
  listingId: string;
  file: File;
  kind: "image" | "video";
  onProgress: (ratio: number) => void;
}): Promise<UploadResult> {
  const { listingId, file, kind, onProgress } = options;
  const signed = await api<Signed>("/api/media/sign", {
    method: "POST",
    body: JSON.stringify({ listingId, contentType: file.type, byteSize: file.size, kind }),
  });
  if (!signed.ok) return { ok: false, error: friendlyError(signed.error) };
  const target = signed.data;
  const local = target.uploadUrl.startsWith("/");
  const body = new FormData();
  body.set("file", file);
  if (local) {
    body.set("mediaId", target.mediaId);
  } else {
    body.set("api_key", target.apiKey || "");
    body.set("timestamp", String(target.timestamp || ""));
    body.set("signature", target.signature || "");
    body.set("folder", target.folder || "");
    for (const [key, value] of Object.entries(target.params || {})) body.set(key, String(value));
  }
  const sent = await postWithProgress(target.uploadUrl, body, onProgress);
  if (!sent) {
    return { ok: false, error: kind === "video" ? `That video could not be saved. ${VIDEO_RULE_NOTE}` : "That photo could not be saved. Try a smaller JPG, PNG, or WebP." };
  }
  if (!local) {
    const done = await api("/api/media/complete", { method: "POST", body: JSON.stringify({ mediaId: target.mediaId }) });
    if (!done.ok) return { ok: false, error: friendlyError(done.error) };
  }
  return { ok: true, mediaId: target.mediaId };
}
