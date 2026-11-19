import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { AuditRepository } from "@/server/audit";
import { undoWindowDays } from "@/server/admin/undo/registry";
import { Category, Listing, Location } from "@/server/models";
import { DEMO_END_STATUS, demoFilter } from "@/server/listings/demo-ads";

/** H16.5: when a category in a city has this many real live ads, its sample (demo) ads there are ended. */
export const DEMO_RETIRE_AT = 15;

const DAY_MS = 24 * 60 * 60 * 1000;
const SAMPLE = 20;
const audit = new AuditRepository();

type Place = { categoryId: Types.ObjectId | string; cityId: Types.ObjectId | string };

function liveNow() {
  return { status: "active" as const, $nor: [{ expiresAt: { $lte: new Date() } }] };
}

/**
 * Ends the demo ads of one category in one city once it has DEMO_RETIRE_AT real live ads. It uses the same end as the admin
 * "End demo ads" button (status and batch id, one audit row of the same action, the same Undo and Restore), written by the system.
 * Returns how many demo ads were ended; 0 when the place is not full yet or has no demo ads.
 */
export async function retireDemoAdsFor(place: Place): Promise<number> {
  await connectDb();
  const demo = await demoFilter();
  if (!demo) return 0;
  const real = await Listing.countDocuments({ categoryId: place.categoryId, cityId: place.cityId, ...liveNow(), $and: [{ $nor: [demo] }] });
  if (real < DEMO_RETIRE_AT) return 0;
  const ads = await Listing.find({ ...demo, categoryId: place.categoryId, cityId: place.cityId, status: "active" })
    .select("_id slug")
    .lean<{ _id: Types.ObjectId; slug?: string }[]>();
  if (ads.length === 0) return 0;
  const batch = randomUUID();
  const result = await Listing.updateMany(
    { ...demo, _id: { $in: ads.map((row) => row._id) }, status: "active" },
    { $set: { status: DEMO_END_STATUS, demoEndedBatch: batch } },
  );
  const ended = result.modifiedCount;
  if (ended === 0) return 0;
  const [category, city] = await Promise.all([
    Category.findById(place.categoryId).select("name").lean<{ name?: string } | null>(),
    Location.findById(place.cityId).select("name").lean<{ name?: string } | null>(),
  ]);
  const where = `${category?.name ?? "a category"} in ${city?.name ?? "a city"}`;
  const days = await undoWindowDays("demo");
  await audit.append({
    actorId: null,
    actorType: "system",
    action: "listing.demo.end",
    targetType: "listing",
    targetId: "demo-ads",
    before: { active: ads.length },
    after: { ended, status: DEMO_END_STATUS, batch, auto: true, realAds: real, sample: ads.slice(0, SAMPLE).map((row) => row.slug ?? String(row._id)) },
    summary: `Ended ${ended} demo ${ended === 1 ? "ad" : "ads"} in ${where}: it has ${real} real ads`,
    undo: { kind: "demo.end", until: new Date(Date.now() + days * DAY_MS), data: { batch } },
    requestId: randomUUID(),
  });
  await refreshPublicCache();
  return ended;
}

/** The daily check: every category and city with DEMO_RETIRE_AT or more real live ads has its demo ads ended. */
export async function retireFullDemoPlaces(): Promise<{ places: number; ended: number }> {
  await connectDb();
  const demo = await demoFilter();
  if (!demo) return { places: 0, ended: 0 };
  const full = await Listing.aggregate<{ _id: { categoryId: Types.ObjectId; cityId: Types.ObjectId }; n: number }>([
    { $match: { ...liveNow(), $nor: [demo, { expiresAt: { $lte: new Date() } }], cityId: { $ne: null }, categoryId: { $ne: null } } },
    { $group: { _id: { categoryId: "$categoryId", cityId: "$cityId" }, n: { $sum: 1 } } },
    { $match: { n: { $gte: DEMO_RETIRE_AT } } },
  ]);
  let ended = 0;
  let places = 0;
  for (const row of full) {
    const count = await retireDemoAdsFor(row._id);
    if (count > 0) {
      places += 1;
      ended += count;
    }
  }
  return { places, ended };
}
