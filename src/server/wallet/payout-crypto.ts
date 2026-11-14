import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { InternalError } from "@/server/http";

/**
 * Encryption for sensitive payout fields (PAN, bank account, IFSC, UPI ID, legal name).
 * Key comes from CONTACT_ENCRYPTION_KEY (env name only, never a value in code). AES-256-GCM, random 12-byte IV per field.
 */
const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const MIN_SECRET_LENGTH = 16;

function key(): Buffer {
  const secret = process.env.CONTACT_ENCRYPTION_KEY?.trim() ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new InternalError("Encryption is not configured (set CONTACT_ENCRYPTION_KEY)");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), body.toString("base64")].join(":");
}

export function decryptField(stored: string): string {
  const [version, iv, tag, body] = stored.split(":");
  if (version !== VERSION || !iv || !tag || !body) throw new InternalError("Stored payout field is unreadable");
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}

/** Shows only the last `keep` characters. Used for every display of a sensitive value. */
export function maskTail(value: string, keep = 4): string {
  const shown = value.slice(-keep);
  return `${"*".repeat(Math.max(0, value.length - keep))}${shown}`;
}

/** UPI IDs keep the handle's first two characters and the provider, so the vendor can recognise their own ID. */
export function maskUpi(upiId: string): string {
  const at = upiId.indexOf("@");
  if (at < 0) return maskTail(upiId);
  const handle = upiId.slice(0, at);
  return `${handle.slice(0, 2)}${"*".repeat(Math.max(1, handle.length - 2))}${upiId.slice(at)}`;
}
