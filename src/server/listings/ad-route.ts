import { splitAdSegment } from "@/lib/ad-address";
import { connectDb } from "@/lib/db";
import { getDistricts } from "@/lib/queries";
import { fillAdCode, resolveAdByCode } from "@/server/listings/ad-code";
import { listingVisibility } from "@/server/listings/visibility";
import { Listing, listingAddressPath } from "@/server/models/listing";

export type AdAddressMatch = { slug: string } | { redirect: string } | null;

/**
 * H16.2: what /<category>/<city>/<x>/ is. A known area of that city always wins (the caller checks that first by
 * calling this only when x is not an area). Then "...-<code>" is an ad: the right address shows the ad, a wrong
 * category, city or title part gets a permanent redirect to the right one, and an unknown code is not an ad.
 */
export async function resolveAdAddress(category: string, location: string, x: string): Promise<AdAddressMatch> {
  const parts = splitAdSegment(x);
  if (!parts) return null;
  await connectDb();
  const districts = await getDistricts(location);
  if (districts.some((row) => row.slug === x)) return null;
  const ad = await resolveAdByCode(parts.code);
  if (!ad?.slug) return null;
  const doc = await Listing.findById(ad._id).select("title categoryId cityId code status expiresAt").lean();
  if (!doc || listingVisibility(doc) === "gone" || listingVisibility(doc) === "missing") return null;
  const canonical = await listingAddressPath(doc);
  if (!canonical) return null;
  return canonical === `/${category}/${location}/${x}/` ? { slug: ad.slug } : { redirect: canonical };
}

/**
 * H16.2: the new address for an old /ad/<slug>/ link, or null when the ad cannot have one. An ad that was saved before
 * codes existed gets its code here, the first time its old link is opened.
 */
export async function legacyAdRedirect(slug: string): Promise<string | null> {
  await connectDb();
  const doc = await Listing.findOne({ slug }).select("_id slug title categoryId cityId code status expiresAt").lean();
  if (!doc) return null;
  const access = listingVisibility(doc);
  if (access === "gone" || access === "missing") return null;
  if (!doc.code) {
    await fillAdCode(doc);
    const again = await Listing.findById(doc._id).select("title categoryId cityId code").lean();
    return again ? listingAddressPath(again) || null : null;
  }
  return listingAddressPath(doc) || null;
}

/** H16.2: the public address of an ad found by its old slug, or "" when it has none yet. */
export async function addressForSlug(slug: string): Promise<string> {
  await connectDb();
  const doc = await Listing.findOne({ slug }).select("title categoryId cityId code").lean();
  return doc ? listingAddressPath(doc) : "";
}
