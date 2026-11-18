/** Client-side checks and upload for the create-ad screen. The server repeats every rule. */

import { fileProblem, UPLOAD_RULES, videoProblem } from "@/components/upload/rules";
import { uploadStaffFile } from "@/components/upload/staff-upload";

export type MediaKind = "image" | "video";

/** H7.8: the reason one file is refused, in plain words, or null when it may be uploaded. Limits come from the upload rules. */
export async function refusalFor(file: File, kind: MediaKind): Promise<string | null> {
  const rule = kind === "image" ? UPLOAD_RULES.adPhotos : UPLOAD_RULES.adVideos;
  const problem = fileProblem(file, rule, { anySize: kind === "image" });
  if (problem || kind === "image") return problem;
  try {
    return videoProblem(await videoSeconds(file), rule);
  } catch {
    return videoProblem(Number.NaN, rule);
  }
}

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

export type UploadOutcome = { ok: true; mediaId: string } | { ok: false; error: string };

/**
 * Sends one file straight to Cloudinary with a signed request (H13.1), so a normal phone photo is not stopped by the host's 4.5 MB request limit.
 * `ownerEmail` is blank for the staff account itself; `categoryId` lets the server refuse a video on a people listing.
 * Where Cloudinary is not set up (local development) the old route /admin/ads/photos/ takes the file.
 * `onProgress` reports the share sent (0 to 1) as the file goes up.
 */
export async function uploadAdMedia(file: File, kind: MediaKind, ownerEmail: string, onProgress?: (ratio: number) => void, categoryId?: string): Promise<UploadOutcome> {
  const result = await uploadStaffFile<{ mediaId?: string }>({
    purpose: "ad",
    kind,
    file,
    ownerEmail,
    categoryId,
    legacy: { url: "/admin/ads/photos/", fields: { kind, ownerEmail } },
    onProgress,
  });
  if (result.ok && result.data.mediaId) return { ok: true, mediaId: result.data.mediaId };
  return { ok: false, error: result.ok ? "Upload failed" : result.error };
}
