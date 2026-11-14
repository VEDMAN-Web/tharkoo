import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { isDuplicateKey } from "@/server/http";
import { AdCounter, AdEvent, type AdEventType } from "@/server/models/ad-event";
import { Listing } from "@/server/models/listing";

export interface AdEventInput {
  slug: string;
  type: AdEventType;
}

export interface RecordActor {
  /** HMAC from visitorKeyFor(). Null only when the caller has neither a user nor a cookie. */
  visitorKey: string | null;
  userId?: string;
  isStaff: boolean;
  isBot: boolean;
}

type ListingRow = { _id: Types.ObjectId; slug?: string; ownerId: Types.ObjectId };

/**
 * Inserts one AdEvent row. Returns false when the visitor already counted this ad for this type.
 * The unique index decides the race: only the insert that wins returns true.
 */
async function insertOnce(listingId: Types.ObjectId, visitorKey: string, type: AdEventType): Promise<boolean> {
  try {
    await AdEvent.create({ listingId, visitorKey, type });
    return true;
  } catch (error) {
    if (isDuplicateKey(error)) return false;
    throw error;
  }
}

/** Adds one to the real counter. Upserts the counter row once; a concurrent first insert is retried as a plain update. */
async function bumpReal(listingId: Types.ObjectId, type: AdEventType): Promise<void> {
  const field = type === "view" ? "realViews" : "realClicks";
  try {
    await AdCounter.updateOne({ listingId }, { $inc: { [field]: 1 } }, { upsert: true });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    await AdCounter.updateOne({ listingId }, { $inc: { [field]: 1 } });
  }
}

/**
 * H6.17: counts views and clicks once per visitor, per ad, ever.
 * Not counted: bots, staff, the ad's owner, ads that are not active (drafts, previews, removed).
 * Returns how many new rows were counted.
 */
export async function recordAdEvents(events: AdEventInput[], actor: RecordActor): Promise<{ counted: number }> {
  if (actor.isBot || actor.isStaff || !actor.visitorKey || events.length === 0) return { counted: 0 };
  await connectDb();
  await Promise.all([AdEvent.init(), AdCounter.init()]);
  const slugs = [...new Set(events.map((event) => event.slug))];
  const rows = await Listing.find({ slug: { $in: slugs }, status: "active" })
    .select("_id slug ownerId")
    .lean<ListingRow[]>();
  const bySlug = new Map(rows.map((row) => [row.slug ?? "", row]));
  const handled = new Set<string>();
  let counted = 0;
  for (const event of events) {
    const listing = bySlug.get(event.slug);
    if (!listing) continue;
    if (actor.userId && String(listing.ownerId) === actor.userId) continue;
    const once = `${String(listing._id)}:${event.type}`;
    if (handled.has(once)) continue;
    handled.add(once);
    if (await insertOnce(listing._id, actor.visitorKey, event.type)) {
      await bumpReal(listing._id, event.type);
      counted += 1;
    }
  }
  return { counted };
}
