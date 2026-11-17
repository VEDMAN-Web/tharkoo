import { Location } from "@/server/models";
import { connectDb } from "@/lib/db";

interface PublishedListing {
  slug?: string | null;
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

/**
 * Clears the shared caches and asks Next to rebuild each page that lists the ad, so it shows at once instead of after
 * the 60 second revalidate. Safe outside a Next request (scripts, unit tests): it then does nothing.
 */
export async function revalidateListingPages(listing: PublishedListing, categorySlug?: string | null) {
  await connectDb();
  try {
    const { purgeNext, refreshPublicCache } = await import("@/lib/cache");
    await refreshPublicCache("listing pages");
    await purgeNext({ paths: await listingPagePaths(listing, categorySlug), caller: "listing pages" });
  } catch (error) {
    console.error("listing pages could not be refreshed", error instanceof Error ? error.message : error);
  }
}
