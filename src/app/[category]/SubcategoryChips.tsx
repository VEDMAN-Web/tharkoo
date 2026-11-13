import Link from "next/link";
import { placePath } from "@/lib/urls";
import { subcategoryChips } from "@/server/categories/public";

/**
 * Sub-category chips with live counts, linking to the sub-category x city page. On a category page the chip goes to the city with the most ads
 * for it. Shows nothing when no sub-category has ads.
 * The heading is the code default until a UI-text key is added for it.
 */
export async function SubcategoryChips({ category, city, heading = "Browse by type" }: { category: string; city?: string; heading?: string }) {
  const chips = await subcategoryChips(category, city).catch(() => []);
  if (chips.length === 0) return null;
  return (
    <section className="tk-container" data-tk="subcategory-chips" aria-labelledby="sub-chips-h" style={{ paddingBottom: 24 }}>
      <h2 id="sub-chips-h">{heading}</h2>
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
