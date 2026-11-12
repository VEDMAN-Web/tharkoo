import { Location } from "@/server/models";

interface PublishedListing {
  slug?: string | null;
  cityId?: unknown;
  districtId?: unknown;
}

/** Every public page that shows a newly published ad: home, category, city, district and the ad itself. */
export async function listingPagePaths(listing: PublishedListing, categorySlug?: string | null) {
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
  try {
    const { refreshPublicCache } = await import("@/lib/cache");
    await refreshPublicCache();
    const { revalidatePath } = await import("next/cache");
    for (const path of await listingPagePaths(listing, categorySlug)) revalidatePath(path);
  } catch {
    /* no Next request store */
  }
}
