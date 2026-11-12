import type { ListingDoc } from "@/lib/models";

/**
 * Stars are drawn first, then the feed. An admin pin asks for a slot in the page as shown, so on page 1 a pinned ad is
 * placed at that slot of the combined list (a pin at position 1 comes before the stars).
 */
export function withPins(stars: ListingDoc[], items: ListingDoc[], page: number) {
  const rest = items.filter((ad) => !stars.some((star) => star.slug && star.slug === ad.slug));
  const pinned = page === 1 ? rest.filter((ad) => ad.pinPosition).sort((a, b) => (a.pinPosition ?? 0) - (b.pinPosition ?? 0)) : [];
  const list = [...stars, ...rest].filter((ad) => !pinned.includes(ad));
  for (const ad of pinned) list.splice(Math.min(Math.max(ad.pinPosition ?? 1, 1) - 1, list.length), 0, ad);
  return list;
}
