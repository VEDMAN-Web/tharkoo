/**
 * "gone" is the 410 answer. An ad is gone the moment its expiry passes (H6.7: ads live about 3 days and
 * there is no "ended" page). "ended" is kept in the type for older callers and is never returned now.
 */
export type ListingAccess = "live" | "ended" | "gone" | "missing";

export function listingVisibility(
  doc: { status?: string; expiresAt?: Date | string | null } | null | undefined,
  now = Date.now(),
): ListingAccess {
  if (!doc) return "missing";
  if (doc.status === "removed" || doc.status === "deleted") return "gone";
  const expiry = doc.expiresAt ? new Date(doc.expiresAt).getTime() : null;
  const expired = doc.status === "expired" || (doc.status === "active" && expiry !== null && expiry <= now);
  if (expired) return "gone";
  if (doc.status !== "active") return "missing";
  return "live";
}
