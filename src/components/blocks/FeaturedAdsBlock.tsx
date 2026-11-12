import { AdCard } from "@/components/ui/AdCard";
import { getFeed } from "@/lib/queries";
import type { ListingDoc } from "@/lib/models";

interface Props {
  title?: string;
  listingIds?: string[];
}

/** Ads an editor picked by id, shown in the order they were picked. Ads that are not active are skipped. */
export async function FeaturedAdsBlock({ title, listingIds = [] }: Props) {
  if (!listingIds.length) return null;
  const feed = await getFeed({ publicId: { $in: listingIds } }, 1);
  const byId = new Map((feed.items as ListingDoc[]).map((ad) => [String(ad.publicId), ad]));
  const items = listingIds.map((id) => byId.get(id)).filter((ad): ad is ListingDoc => Boolean(ad));
  if (!items.length) return null;
  return (
    <section className="tk-block tk-container">
      {title ? <h2>{title}</h2> : null}
      <div className="tk-feed">
        {items.map((ad) => (
          <AdCard key={ad.slug || ad.publicId} ad={ad} featured />
        ))}
      </div>
    </section>
  );
}
