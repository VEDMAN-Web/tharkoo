import { AdCard } from "@/components/ui/AdCard";
import { getFeed } from "@/lib/queries";
import type { ListingDoc } from "@/lib/models";

interface Props {
  title?: string;
  source?: "visitorCity" | "fixedCity" | "all";
  citySlug?: string;
  categorySlug?: string;
  count?: number;
  layout?: "grid" | "list";
  showPhotos?: boolean;
}

/** The newest ranked ads, optionally for one city or category. "Visitor city" needs the visitor's location, so it shows all cities for now. */
export async function LatestAdsBlock({ title, source = "all", citySlug, categorySlug, count = 8, layout = "grid", showPhotos = true }: Props) {
  const filter: Record<string, unknown> = {};
  if (source === "fixedCity" && citySlug) filter.citySlug = citySlug;
  if (categorySlug) filter.categorySlug = categorySlug;
  const feed = await getFeed(filter, 1);
  const items = (feed.items as ListingDoc[]).slice(0, count);
  if (!items.length) return null;
  return (
    <section className="tk-block tk-container" data-layout={layout}>
      {title ? <h2>{title}</h2> : null}
      <div className="tk-feed">
        {items.map((ad) => (
          <AdCard key={ad.slug || ad.publicId} ad={showPhotos ? ad : { ...ad, photos: [] }} />
        ))}
      </div>
    </section>
  );
}
