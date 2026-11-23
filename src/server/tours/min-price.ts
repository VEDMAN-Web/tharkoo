import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { Category } from "@/server/models";
import { TOUR_MIN_PRICE_COINS } from "./split";

const audit = new AuditRepository();

/**
 * H19.10: the lowest price of a video call is 10 credits. Categories still on a lower price (or none, which meant 1) are raised to 10.
 * Safe to run any number of times; it writes one audit row when it changes something.
 */
export async function raiseLowCallPrices(requestId = "min-call-price") {
  await connectDb();
  const filter = { $or: [{ videoTourCoins: { $lt: TOUR_MIN_PRICE_COINS } }, { videoTourCoins: { $exists: false } }, { videoTourCoins: null }] };
  const low = await Category.find(filter).select("slug videoTourCoins").lean<{ slug?: string; videoTourCoins?: number | null }[]>();
  if (low.length === 0) return { raised: [] as { slug: string; was: number }[] };
  await Category.updateMany(filter, { $set: { videoTourCoins: TOUR_MIN_PRICE_COINS } });
  const raised = low.map((row) => ({ slug: row.slug ?? "", was: row.videoTourCoins ?? 1 }));
  await audit.append({ actorType: "system", action: "video_tours.min_price.raise", targetType: "category", targetId: "all", requestId, after: { to: TOUR_MIN_PRICE_COINS, raised } });
  return { raised };
}
