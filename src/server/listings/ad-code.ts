import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { adAddress, isAdCode } from "@/lib/ad-address";
import { Category, Location } from "@/server/models/catalog";
import { freeAdCode, Listing, listingAddressPath } from "@/server/models/listing";

export type AdByCode = {
  _id: unknown;
  slug?: string;
  code: string;
  status?: string;
  title?: string;
  addressPath?: string;
  previousPaths?: string[];
};

/** H16.2: the ad that owns this code, or null. The code, not the path, is what finds an ad. */
export async function resolveAdByCode(code: string): Promise<AdByCode | null> {
  if (!isAdCode(code)) return null;
  await connectDb();
  return Listing.findOne({ code }).select("slug code status title addressPath previousPaths").lean<AdByCode | null>();
}

type Missing = { _id: unknown; slug?: string; title?: string; categoryId?: Types.ObjectId; cityId?: Types.ObjectId };

const NO_CODE = [{ code: { $exists: false } }, { code: null }, { code: "" }];

/** Writes one code (and the address, once the ad has a slug) to an ad that has none. Returns true when it wrote. */
export async function fillAdCode(ad: Missing): Promise<boolean> {
  const code = await freeAdCode();
  const addressPath = ad.slug ? await listingAddressPath({ categoryId: ad.categoryId, cityId: ad.cityId, title: ad.title, code }) : "";
  const result = await Listing.collection.updateOne({ _id: ad._id as never, $or: NO_CODE }, { $set: { code, ...(addressPath ? { addressPath } : {}) } });
  return result.modifiedCount > 0;
}

/**
 * H16.2: gives ads that were saved before codes existed their code and address. Safe to run again: it only touches ads
 * with no code, and each write checks that the code is still missing. Called by the cron run (200 a time) and by tests.
 */
export async function backfillAdCodes(limit = 200): Promise<{ filled: number; remaining: number }> {
  await connectDb();
  const batch = await Listing.find({ $or: NO_CODE }).select("_id slug title categoryId cityId").limit(limit).lean<Missing[]>();
  let filled = 0;
  for (const ad of batch) if (await fillAdCode(ad)) filled += 1;
  return { filled, remaining: await Listing.countDocuments({ $or: NO_CODE }) };
}

type AddressSource = { _id: unknown; title?: string; categoryId?: Types.ObjectId; cityId?: Types.ObjectId; code?: string };

/** H16.2: public addresses for a list of ads with two lookups in all. An ad without a code, category or city has none. */
export async function addressesFor(ads: readonly AddressSource[]): Promise<Map<string, string>> {
  const ready = ads.filter((ad) => ad.code && ad.title && ad.categoryId && ad.cityId);
  const result = new Map<string, string>();
  if (!ready.length) return result;
  await connectDb();
  const [categories, cities] = await Promise.all([
    Category.find({ _id: { $in: [...new Set(ready.map((ad) => String(ad.categoryId)))] } }).select("slug").lean<{ _id: unknown; slug?: string }[]>(),
    Location.find({ _id: { $in: [...new Set(ready.map((ad) => String(ad.cityId)))] } }).select("slug").lean<{ _id: unknown; slug?: string }[]>(),
  ]);
  const categorySlug = new Map(categories.map((row) => [String(row._id), row.slug ?? ""]));
  const citySlug = new Map(cities.map((row) => [String(row._id), row.slug ?? ""]));
  for (const ad of ready) {
    const category = categorySlug.get(String(ad.categoryId));
    const city = citySlug.get(String(ad.cityId));
    if (category && city) result.set(String(ad._id), adAddress({ categorySlug: category, citySlug: city, title: ad.title as string, code: ad.code as string }));
  }
  return result;
}

/** H16.2: the public path of each ad for IndexNow and cache purges: its address, or the old /ad/<slug>/ link while it has none. */
export async function publicPathsOf(ads: readonly (AddressSource & { slug?: string })[]): Promise<string[]> {
  const addresses = await addressesFor(ads);
  return ads.flatMap((ad) => {
    const address = addresses.get(String(ad._id));
    return address ? [address] : ad.slug ? [`/ad/${ad.slug}/`] : [];
  });
}
