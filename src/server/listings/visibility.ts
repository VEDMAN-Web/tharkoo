const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type ListingAccess = "live" | "ended" | "gone" | "missing";

export function listingVisibility(
  doc: { status?: string; expiresAt?: Date | string | null } | null | undefined,
  now = Date.now(),
): ListingAccess {
  if (!doc) return "missing";
  if (doc.status === "removed" || doc.status === "deleted") return "gone";
  const expiry = doc.expiresAt ? new Date(doc.expiresAt).getTime() : null;
  const expired = doc.status === "expired" || (doc.status === "active" && expiry !== null && expiry <= now);
  if (expired) {
    const endedAt = expiry ?? now;
    return now - endedAt > WINDOW_MS ? "gone" : "ended";
  }
  if (doc.status !== "active") return "missing";
  return "live";
}
