import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import type { ListingDoc } from "@/lib/models";
import { Category, Listing, Location } from "@/server/models";
import { queryListings } from "@/server/search";

/**
 * H16.4: what the page of an ended ad (expired or removed, within 30 days) may show: only where the ad was, and similar live ads.
 * Nothing of the ad's own text, photos or contact leaves this module.
 */

export type EndedAdView = { categorySlug: string; categoryName: string; citySlug: string; cityName: string; similar: ListingDoc[] };

const SIMILAR = 6;

export async function loadEndedAd(slug: string): Promise<EndedAdView | null> {
  await connectDb();
  const row = await Listing.findOne({ slug }).select("categoryId cityId").lean<{ categoryId?: Types.ObjectId; cityId?: Types.ObjectId } | null>();
  if (!row) return null;
  const [category, city] = await Promise.all([
    row.categoryId ? Category.findById(row.categoryId).select("slug name").lean<{ slug?: string; name?: string } | null>() : null,
    row.cityId ? Location.findById(row.cityId).select("slug name").lean<{ slug?: string; name?: string } | null>() : null,
  ]);
  const categorySlug = category?.slug ?? "";
  const citySlug = city?.slug ?? "";
  let similar: ListingDoc[] = [];
  if (categorySlug && citySlug) similar = (await queryListings({ categorySlug, citySlug, page: 1, pageSize: SIMILAR + 1, sort: "fresh" })).legacy as ListingDoc[];
  if (similar.length < 3 && categorySlug) {
    const more = (await queryListings({ categorySlug, page: 1, pageSize: SIMILAR + 1, sort: "fresh" })).legacy as ListingDoc[];
    const seen = new Set(similar.map((ad) => ad.slug));
    similar = [...similar, ...more.filter((ad) => !seen.has(ad.slug))];
  }
  return { categorySlug, categoryName: category?.name ?? categorySlug, citySlug, cityName: city?.name ?? citySlug, similar: similar.filter((ad) => ad.slug !== slug).slice(0, SIMILAR) };
}
