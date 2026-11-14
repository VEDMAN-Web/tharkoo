import Link from "next/link";
import { placePath } from "@/lib/urls";
import { textOverrides } from "@/app/admin/ui-text/store";
import { makeT } from "@/lib/ui/text";
import { subcategoryChips } from "@/server/categories/public";

/**
 * Sub-category chips with live counts, linking to the sub-category x city page. On a category page the chip goes to the city with the most ads
 * for it. Shows nothing when no sub-category has ads.
 * The heading is the "listing.hub.browseBySub" UI-text key unless a caller passes its own.
 */
export async function SubcategoryChips({ category, city, heading }: { category: string; city?: string; heading?: string }) {
  const chips = await subcategoryChips(category, city).catch(() => []);
  if (chips.length === 0) return null;
  const title = heading ?? makeT(await textOverrides())("listing.hub.browseBySub");
  return (
    <section className="tk-container" data-tk="subcategory-chips" aria-labelledby="sub-chips-h" style={{ paddingBottom: 24 }}>
      <h2 id="sub-chips-h">{title}</h2>
      <div className="tk-pills tk-pills-left">
        {chips.map((chip) => (
          <Link key={chip.slug} href={placePath(category, chip.citySlug, chip.slug)} className="tk-pill" prefetch={false}>
            {chip.name} ({chip.count})
          </Link>
        ))}
      </div>
    </section>
  );
}
