import { createHash } from "node:crypto";

/** Cloudinary signature version 2 (sha1 of the sorted params plus the secret). */
export function signUploadParams(params: Record<string, string | number>, apiSecret: string) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`.replace(/&/g, "%26"))
    .join("&");
  return createHash("sha1").update(serialized + apiSecret).digest("hex");
}
