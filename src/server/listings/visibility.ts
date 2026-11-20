/**
 * What a visitor gets for an ad address.
 *  - "live": the ad.
 *  - "ended": an expired or removed ad within ENDED_PAGE_DAYS of its end. The page answers 200 with "This ad is no longer available",
 *    similar ads and noindex, and none of the ad's own text, photos or contact.
 *  - "gone": the 410 answer (after those days, or at once for an ad its owner deleted).
 *  - "missing": the 404 answer (never public: draft, pending, rejected, paused, or no such ad).
 */
export type ListingAccess = "live" | "ended" | "gone" | "missing";

export const ENDED_PAGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type Doc = { status?: string; expiresAt?: Date | string | null; updatedAt?: Date | string | null };

function time(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const at = new Date(value).getTime();
  return Number.isNaN(at) ? null : at;
}

/** When the ad ended: its expiry for an ad that ran out, the last change for a removed one. Null when unknown. */
export function endedAt(doc: Doc): number | null {
  if (doc.status === "removed") return time(doc.updatedAt) ?? time(doc.expiresAt);
  return time(doc.expiresAt) ?? time(doc.updatedAt);
}

function endedAccess(doc: Doc, now: number): ListingAccess {
  const at = endedAt(doc);
  if (at === null) return "gone";
  return now - at < ENDED_PAGE_DAYS * DAY_MS ? "ended" : "gone";
}

export function listingVisibility(doc: Doc | null | undefined, now = Date.now()): ListingAccess {
  if (!doc) return "missing";
  if (doc.status === "deleted") return "gone";
  if (doc.status === "removed") return endedAccess(doc, now);
  const expiry = time(doc.expiresAt);
  const expired = doc.status === "expired" || (doc.status === "active" && expiry !== null && expiry <= now);
  if (expired) return endedAccess(doc, now);
  if (doc.status !== "active") return "missing";
  return "live";
}
