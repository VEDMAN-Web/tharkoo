import { Category, Listing, Location } from "@/server/models";
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

const MAX_REVALIDATE = 200;

/**
 * H17.2: clears the shared caches once and the stored pages of each of these ads (its own page, category, city and area pages,
 * and the home feed). For an ad that was paused, removed, ended, renewed or resumed by its owner or by the expiry job: pages
 * are stored for 300 seconds, so a change must not wait for that. Never fails the change that called it.
 */
export async function revalidateListingsById(ids: readonly string[]) {
  if (ids.length === 0) return;
  try {
    await connectDb();
    const rows = await Listing.find({ _id: { $in: ids.slice(0, MAX_REVALIDATE) } })
      .select("slug cityId districtId categoryId")
      .lean<{ slug?: string; cityId?: unknown; districtId?: unknown; categoryId?: unknown }[]>();
    const categories = await Category.find({ _id: { $in: rows.map((row) => row.categoryId) as never[] } })
      .select("slug")
      .lean<{ _id: unknown; slug?: string }[]>();
    const slugs = new Map(categories.map((category) => [String(category._id), category.slug]));
    const paths = new Set<string>();
    for (const row of rows) for (const path of await listingPagePaths(row, slugs.get(String(row.categoryId)))) paths.add(path);
    const { purgeNext, refreshPublicCache } = await import("@/lib/cache");
    await refreshPublicCache("listing pages");
    await purgeNext({ paths: [...paths], caller: "listing pages" });
  } catch (error) {
    console.error("listing pages could not be refreshed", error instanceof Error ? error.message : error);
  }
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

/**
 * Clears the shared caches and asks Next to rebuild each page that lists the ad, so it shows at once instead of after
 * the 60 second revalidate. Safe outside a Next request (scripts, unit tests): it then does nothing.
 */
export async function revalidateListingPages(listing: PublishedListing, categorySlug?: string | null) {
  await connectDb();
  await retireSampleAds(listing);
  try {
    const { purgeNext, refreshPublicCache } = await import("@/lib/cache");
    await refreshPublicCache("listing pages");
    await purgeNext({ paths: await listingPagePaths(listing, categorySlug), caller: "listing pages" });
  } catch (error) {
    console.error("listing pages could not be refreshed", error instanceof Error ? error.message : error);
  }
}
