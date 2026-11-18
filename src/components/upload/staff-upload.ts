import { shrinkPhoto } from "@/lib/image-shrink";
import { api, type ApiError } from "@/lib/ui/api";

/**
 * H13.1: one way for the staff screens (create ad, Media library, import) to send a photo or video.
 * The browser asks our server for a signature, sends the file straight to Cloudinary, then tells our server it is done.
 * The file never goes through our server, so the host's 4.5 MB request limit does not apply.
 * Where Cloudinary is not set up (local development) the answer to the signing call is "legacy" and the screen's old route is used.
 */

export type StaffPurpose = "ad" | "library" | "import";

/** Shown when the answer is not one of ours (a host error page, a dropped connection): never "Connection problem" for a size refusal. */
export const STAFF_FILE_FAILED = "This file could not be uploaded (too big or a network problem). Try a smaller photo.";

type Signed =
  | { mode: "legacy" }
  | { mode: "cloudinary"; mediaId: string; uploadUrl: string; apiKey: string; timestamp: number; signature: string; folder: string; params?: Record<string, string | number> };

export type StaffUploadResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type StaffUploadOptions = {
  purpose: StaffPurpose;
  kind: "image" | "video";
  file: File;
  /** What the server needs to sign: the account the ad is for, the import job, the chosen category (for the people rule). */
  ownerEmail?: string;
  jobId?: string;
  categoryId?: string;
  /** What the server needs to finish: alt text and tags of a Media library image. */
  alt?: string;
  tags?: string;
  autoAlt?: boolean;
  /** The old route and the form fields it wants, used only where Cloudinary is not set up. */
  legacy: { url: string; fields: Record<string, string> };
  onProgress?: (ratio: number) => void;
};

/** The sentence a refusing server (or Cloudinary) wrote in its JSON answer, when there is one. */
function sentenceOf(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const raw = typeof parsed.error === "string" ? parsed.error : (parsed.error as { message?: unknown } | undefined)?.message ?? parsed.message;
    return typeof raw === "string" && raw.length > 0 && raw.length < 240 ? raw : undefined;
  } catch {
    return undefined;
  }
}

/** POSTs a form with progress. Resolves with the status and the text of the answer, or null when the connection broke. */
function send(url: string, form: FormData, onProgress?: (ratio: number) => void, credentials = false): Promise<{ status: number; text: string } | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = credentials;
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => resolve(null);
    xhr.send(form);
  });
}

/** The server's own plain sentence. An answer that was not ours (the default error of api()) gets the size and network sentence instead. */
function plain(error: ApiError | undefined): string {
  if (!error || error.code === "ERROR") return STAFF_FILE_FAILED;
  return error.message || STAFF_FILE_FAILED;
}

async function call<T>(path: string, body: unknown) {
  try {
    return await api<T>(path, { method: "POST", body: JSON.stringify(body) });
  } catch {
    return { ok: false as const, status: 0, error: { code: "ERROR", message: STAFF_FILE_FAILED } as ApiError };
  }
}

/** The photo limit of the server (8 MB): a bigger photo is made smaller in the browser first. */
const PHOTO_LIMIT_BYTES = 8 * 1024 * 1024;

export async function uploadStaffFile<T = Record<string, unknown>>(options: StaffUploadOptions): Promise<StaffUploadResult<T>> {
  const { purpose, kind } = options;
  let file = options.file;
  // H13.1 part 2: a photo of any size is accepted. It is made smaller here when it is over the limit or over 2560 px; one that fits is sent as it is.
  if (kind === "image") {
    const shrunk = await shrinkPhoto(file, PHOTO_LIMIT_BYTES);
    if (!shrunk.ok) return { ok: false, error: shrunk.error };
    file = shrunk.file;
  }
  const signed = await call<Signed>("/api/media/staff-sign", { purpose, kind, contentType: file.type, byteSize: file.size, ownerEmail: options.ownerEmail, jobId: options.jobId, categoryId: options.categoryId });
  if (!signed.ok) return { ok: false, error: plain(signed.error) };

  if (signed.data.mode === "legacy") {
    const form = new FormData();
    form.set("file", file);
    for (const [key, value] of Object.entries(options.legacy.fields)) form.set(key, value);
    const sent = await send(options.legacy.url, form, options.onProgress, true);
    if (!sent) return { ok: false, error: STAFF_FILE_FAILED };
    const answer = (() => {
      try {
        return JSON.parse(sent.text) as { ok?: boolean; error?: string } & Record<string, unknown>;
      } catch {
        return null;
      }
    })();
    if (!answer) return { ok: false, error: STAFF_FILE_FAILED };
    return answer.ok === false ? { ok: false, error: typeof answer.error === "string" ? answer.error : STAFF_FILE_FAILED } : { ok: true, data: answer as T };
  }

  const target = signed.data;
  const form = new FormData();
  form.set("file", file);
  form.set("api_key", target.apiKey);
  form.set("timestamp", String(target.timestamp));
  form.set("signature", target.signature);
  form.set("folder", target.folder);
  for (const [key, value] of Object.entries(target.params ?? {})) form.set(key, String(value));
  const sent = await send(target.uploadUrl, form, options.onProgress);
  if (!sent) return { ok: false, error: STAFF_FILE_FAILED };
  if (sent.status < 200 || sent.status >= 300) return { ok: false, error: sentenceOf(sent.text) ?? STAFF_FILE_FAILED };

  const done = await call<T>("/api/media/staff-complete", { purpose, mediaId: target.mediaId, fileName: file.name, alt: options.alt, tags: options.tags, autoAlt: options.autoAlt });
  if (!done.ok) return { ok: false, error: plain(done.error) };
  return { ok: true, data: done.data };
}
