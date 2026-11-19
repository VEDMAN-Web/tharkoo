import { Location } from "@/server/models";
import { connectDb } from "@/lib/db";

interface PublishedListing {
  slug?: string | null;
  status?: string | null;
  categoryId?: unknown;
  cityId?: unknown;
  districtId?: unknown;
}

/** Every public page that shows a newly published ad: home, category, city, district and the ad itself. */
export async function listingPagePaths(listing: PublishedListing, categorySlug?: string | null) {
  await connectDb();
  const paths = new Set<string>(["/"]);
  if (listing.slug) paths.add(`/ad/${listing.slug}/`);
  if (categorySlug) {
    paths.add(`/${categorySlug}/`);
    const ids = [listing.cityId, listing.districtId].filter(Boolean);
    const rows = ids.length ? await Location.find({ _id: { $in: ids as never[] } }).select("slug").lean<{ _id: unknown; slug: string }[]>() : [];
    const slugOf = (id: unknown) => rows.find((row) => String(row._id) === String(id))?.slug;
    const city = listing.cityId ? slugOf(listing.cityId) : undefined;
    const district = listing.districtId ? slugOf(listing.districtId) : undefined;
    if (city) paths.add(`/${categorySlug}/${city}/`);
    if (city && district) paths.add(`/${categorySlug}/${city}/${district}/`);
  }
  return [...paths];
}

/** H16.5: a real ad that goes live can fill its category and city (15 real ads), and then that place's sample ads are ended. */
async function retireSampleAds(listing: PublishedListing) {
  if (listing.status !== "active" || !listing.categoryId || !listing.cityId) return;
  try {
    const { retireDemoAdsFor } = await import("@/server/listings/demo-retire");
    await retireDemoAdsFor({ categoryId: String(listing.categoryId), cityId: String(listing.cityId) });
  } catch (error) {
    console.error("sample ads could not be checked", error instanceof Error ? error.message : error);
  }
}

/** H16.4: an ad that goes live, changes or ends is sent to the search engines (IndexNow, only when INDEXNOW_KEY is set). The ad page address comes from the first path. */
async function pingIndexNow(listing: PublishedListing) {
  if (!listing.slug) return;
  try {
    const { queueIndexNow } = await import("@/server/indexnow/ping");
    queueIndexNow([`/ad/${listing.slug}/`]);
  } catch (error) {
    console.error("IndexNow could not be queued", error instanceof Error ? error.message : error);
  }
}

/**
 * Clears the shared caches and asks Next to rebuild each page that lists the ad, so it shows at once instead of after
 * the 60 second revalidate. Safe outside a Next request (scripts, unit tests): it then does nothing.
 */
export async function revalidateListingPages(listing: PublishedListing, categorySlug?: string | null) {
  await connectDb();
  await retireSampleAds(listing);
  await pingIndexNow(listing);
  try {
    const { purgeNext, refreshPublicCache } = await import("@/lib/cache");
    await refreshPublicCache("listing pages");
    await purgeNext({ paths: await listingPagePaths(listing, categorySlug), caller: "listing pages" });
  } catch (error) {
    console.error("listing pages could not be refreshed", error instanceof Error ? error.message : error);
  }
}
