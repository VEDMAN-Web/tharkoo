/** One batch of media uploads: at most 50 files, each at most 8 MB, real image types only. */
export const BATCH_MAX_FILES = 50;
export const BATCH_MAX_BYTES = 8 * 1024 * 1024;
export const BATCH_PARALLEL = 3;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const EXTENSION_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export interface BatchCandidate {
  name: string;
  size: number;
  type: string;
}

export interface BatchCheck<T extends BatchCandidate> {
  accepted: T[];
  rejected: Array<{ name: string; reason: string }>;
}

/** The browser type is trusted only as a hint. The server re-checks the real bytes. */
export function imageTypeOf(file: Pick<BatchCandidate, "name" | "type">): string | null {
  if ((IMAGE_TYPES as readonly string[]).includes(file.type)) return file.type;
  if (file.type) return null;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? null;
}

/** Splits a chosen list into files to upload and files refused before any upload. Nothing is sent here. */
export function checkBatch<T extends BatchCandidate>(files: readonly T[], maxFiles = BATCH_MAX_FILES): BatchCheck<T> {
  const accepted: T[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of files) {
    if (accepted.length >= maxFiles) {
      rejected.push({ name: file.name, reason: `Only ${maxFiles} files per batch. Upload this one in the next batch.` });
    } else if (!imageTypeOf(file)) {
      rejected.push({ name: file.name, reason: "Only jpeg, png or webp images" });
    } else if (file.size > BATCH_MAX_BYTES) {
      rejected.push({ name: file.name, reason: "Larger than 8 MB" });
    } else if (file.size === 0) {
      rejected.push({ name: file.name, reason: "The file is empty" });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}
