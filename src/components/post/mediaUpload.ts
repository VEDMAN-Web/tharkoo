import { api, friendlyError } from "@/lib/ui/api";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_RULE_NOTE = "Use a JPG, PNG, or WebP photo up to 8 MB.";
export const PHOTO_BAD_TYPE = "Use a JPG, PNG or WebP photo.";
export const PHOTO_TOO_BIG = "This photo is too big (max 8 MB).";
export const UPLOAD_FAILED = "Upload failed, tap to retry.";
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 60;
/** H6.18: photos and videos together for one ad. The server checks the same number. */
export const AD_MEDIA_MAX = 10;
export const VIDEO_RULE_NOTE = "Use an mp4, webm or mov video up to 100 MB and 60 seconds.";
export const VIDEO_BAD_TYPE = "Use an mp4, webm or mov video.";
export const VIDEO_TOO_BIG = "This file is too big (max 100 MB).";
export const VIDEO_TOO_LONG = "This video is longer than 60 seconds.";

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
  if (!PHOTO_TYPES.includes(file.type)) return PHOTO_BAD_TYPE;
  return file.size <= PHOTO_MAX_BYTES ? null : PHOTO_TOO_BIG;
}

/** Reads the clip length in the browser. NaN when the browser cannot read the file. */
export function clipSeconds(file: File): Promise<number> {
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
  if (!VIDEO_TYPES.includes(file.type)) return VIDEO_BAD_TYPE;
  if (file.size > VIDEO_MAX_BYTES) return VIDEO_TOO_BIG;
  const seconds = await clipSeconds(file);
  return seconds > VIDEO_MAX_SECONDS ? VIDEO_TOO_LONG : null;
}

export type SendResult = { ok: true } | { ok: false; message?: string };

/** The plain sentence a refusing server put in its answer, when it sent one. */
function refusalOf(text: string): string | undefined {
  try {
    const message = (JSON.parse(text) as { error?: { message?: string } }).error?.message;
    return typeof message === "string" && message.length > 0 && message.length < 200 ? message : undefined;
  } catch {
    return undefined;
  }
}

/** POSTs a form and reports the upload share as it goes. Resolves ok on a 2xx answer, else with the server's sentence if any. */
export function postWithProgress(url: string, body: FormData, onProgress: (ratio: number) => void): Promise<SendResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? { ok: true } : { ok: false, message: xhr.status >= 400 && xhr.status < 500 ? refusalOf(xhr.responseText) : undefined });
    xhr.onerror = () => resolve({ ok: false });
    xhr.send(body);
  });
}

export type UploadResult = { ok: true; mediaId: string } | { ok: false; error: string; retry?: boolean };

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
  if (!sent.ok) {
    return sent.message ? { ok: false, error: sent.message } : { ok: false, error: UPLOAD_FAILED, retry: true };
  }
  if (!local) {
    const done = await api("/api/media/complete", { method: "POST", body: JSON.stringify({ mediaId: target.mediaId }) });
    if (!done.ok) return { ok: false, error: friendlyError(done.error), retry: done.error.code === undefined || done.error.code === "ERROR" };
  }
  return { ok: true, mediaId: target.mediaId };
}
