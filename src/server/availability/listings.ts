import { connectDb } from "@/lib/db";
import { Listing } from "@/server/models/listing";
import { readAwayHours } from "./service";
import { VendorPresence } from "./models";
import { peopleCategoryIds } from "./people";
import { callsAllowed, presenceStatus, type PresenceStatus } from "./status";

/** H7.5: the most ad slugs one request may ask for. Keeps the lookup bounded. */
export const MAX_STATUS_SLUGS = 60;
const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;

export interface ListingPresence {
  status: PresenceStatus;
  callsAllowed: boolean;
  /** The listing is in a people category: no Call button (chat stays). */
  people: boolean;
}

/** The slugs from a comma-separated query value: valid ones only, at most MAX_STATUS_SLUGS. */
export function slugsFromQuery(raw: string | null): string[] {
  if (!raw) return [];
  const slugs = raw.split(",").map((slug) => slug.trim()).filter((slug) => SLUG_PATTERN.test(slug));
  return [...new Set(slugs)].slice(0, MAX_STATUS_SLUGS);
}

/**
 * The seller status behind each ad slug, for the Online now / Away badge and the call button. Only the status and
 * whether calls are allowed leave the server: never the switch, the times or the seller's id.
 */
export async function presenceForSlugs(slugs: string[], now: Date = new Date()): Promise<Record<string, ListingPresence>> {
  if (slugs.length === 0) return {};
  await connectDb();
  const rows = await Listing.find({ slug: { $in: slugs } })
    .select("slug ownerId categoryId")
    .lean<{ slug?: string; ownerId?: unknown; categoryId?: unknown }[]>();
  const owners = [...new Set(rows.map((row) => String(row.ownerId ?? "")).filter(Boolean))];
  const categories = [...new Set(rows.map((row) => String(row.categoryId ?? "")).filter(Boolean))];
  const people = await peopleCategoryIds(categories);
  const [presences, hours] = await Promise.all([
    VendorPresence.find({ userId: { $in: owners } }).lean<{ userId: string; available?: boolean; lastActivityAt?: Date | null }[]>(),
    readAwayHours(),
  ]);
  const byOwner = new Map(presences.map((row) => [row.userId, row]));
  const items: Record<string, ListingPresence> = {};
  for (const row of rows) {
    if (!row.slug) continue;
    const own = byOwner.get(String(row.ownerId ?? ""));
    const status = presenceStatus({ available: own?.available !== false, lastActivityAt: own?.lastActivityAt ?? null }, now.getTime(), hours);
    items[row.slug] = { status, callsAllowed: callsAllowed(status), people: people.has(String(row.categoryId ?? "")) };
  }
  return items;
}
