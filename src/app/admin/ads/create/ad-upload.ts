/** Client-side checks and upload for the create-ad screen. The server repeats every rule. */

import { fileProblem, UPLOAD_RULES, videoProblem } from "@/components/upload/rules";

export type MediaKind = "image" | "video";

/** H7.8: the reason one file is refused, in plain words, or null when it may be uploaded. Limits come from the upload rules. */
export async function refusalFor(file: File, kind: MediaKind): Promise<string | null> {
  const rule = kind === "image" ? UPLOAD_RULES.adPhotos : UPLOAD_RULES.adVideos;
  const problem = fileProblem(file, rule);
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
 * Sends one file to the staff upload route. `ownerEmail` is blank for the staff account itself.
 * `onProgress` reports the share sent (0 to 1) as the file goes up.
 */
export async function uploadAdMedia(file: File, kind: MediaKind, ownerEmail: string, onProgress?: (ratio: number) => void): Promise<UploadOutcome> {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  form.set("ownerEmail", ownerEmail);
  try {
    const body = await sendWithProgress("/admin/ads/photos/", form, onProgress);
    if (body.ok && body.mediaId) return { ok: true, mediaId: body.mediaId };
    return { ok: false, error: body.error || "Upload failed" };
  } catch {
    return { ok: false, error: "Connection problem. Remove this file and add it again." };
  }
}

type RouteAnswer = { ok: boolean; mediaId?: string; error?: string };

/** POSTs the form with XMLHttpRequest so the browser can report how much has gone up. */
function sendWithProgress(url: string, form: FormData, onProgress?: (ratio: number) => void): Promise<RouteAnswer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText) as RouteAnswer);
      } catch {
        reject(new Error("The answer could not be read"));
      }
    };
    xhr.onerror = () => reject(new Error("Connection problem"));
    xhr.send(form);
  });
}
