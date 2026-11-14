import { placePath } from "@/lib/urls";
import { indexableSubcategoryHubs, SUBCATEGORY_HUB_MINIMUM } from "@/server/categories/public";

export interface SubcategorySitemapEntry {
  loc: string;
  lastmod?: string;
}

/**
 * Sitemap rows for sub-category hub pages. Only hubs with enough active ads are listed, the same rule the page
 * uses for its robots tag. `toLoc` turns a path into an absolute URL (the sitemap code passes its own).
 */
export async function subcategorySitemapEntries(
  toLoc: (path: string) => string,
  minimum = SUBCATEGORY_HUB_MINIMUM,
): Promise<SubcategorySitemapEntry[]> {
  const hubs = await indexableSubcategoryHubs(minimum);
  return hubs.map((hub) => ({ loc: toLoc(placePath(hub.category, hub.city, hub.sub)) }));
}
