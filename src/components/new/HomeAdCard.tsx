"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { recordAdClick, useShownCounts, watchAdCard } from "@/components/ad/adCountStore";
import { useSellerStatus } from "@/components/availability/sellerStatus";
import { formatIndianCount } from "@/components/ad/counts-format";
import { formatPrice } from "@/components/search/price";
import { fillText } from "@/lib/ui/text";

export type HomeAdCardData = {
  slug: string;
  title: string;
  price?: number | null;
  photo: string | null;
  categoryName: string;
  place: string;
  href: string;
};

/** The New design ad card for the home page (vertical). Same view counting and click counting as the shared card. */
export function HomeAdCard({
  ad,
  badge,
  labels,
}: {
  ad: HomeAdCardData;
  badge: string;
  labels: { view: string; online: string; away: string; watermark: string; views: string; viewOne: string };
}) {
  const cardRef = useRef<HTMLElement>(null);
  const seller = useSellerStatus(ad.slug || undefined);
  const counts = useShownCounts(ad.slug);
  const price = formatPrice(ad.price);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !ad.slug) return;
    return watchAdCard(el, ad.slug);
  }, [ad.slug]);

  return (
    <article ref={cardRef} className="tkh-ad" data-tk="home-ad">
      <div className="tkh-ad-photo">
        {ad.photo ? (
          <img className="tkh-ad-main" src={ad.photo} alt="" width={400} height={260} loading="lazy" />
        ) : (
          <span className="tkh-ad-empty" aria-hidden />
        )}
        {badge ? <span className="tkh-ad-badge">{badge}</span> : null}
        {seller && seller.chatOn ? (
          <span className={`tkh-ad-status ${seller.status === "online" ? "is-online" : "is-away"}`} data-tk="availability" data-status={seller.status}>
            <span aria-hidden />
            {seller.status === "online" ? labels.online : labels.away}
          </span>
        ) : null}
        <span className="tkh-ad-watermark" aria-hidden>{labels.watermark}</span>
      </div>
      <div className="tkh-ad-body">
        <h3 className="tkh-ad-title">
          <Link
            href={ad.href}
            prefetch={false}
            onClick={() => {
              if (ad.slug) recordAdClick(ad.slug);
            }}
          >
            {ad.title}
          </Link>
        </h3>
        <p className="tkh-ad-pills">
          <span className="tkh-pill tkh-pill-rose">{ad.categoryName}</span>
          {ad.place ? <span className="tkh-pill tkh-pill-lavender">{ad.place}</span> : null}
        </p>
        <div className="tkh-ad-foot">
          {price ? <span className="tkh-ad-price">{price}</span> : null}
          <span className="tkh-ad-meta">
            {/* The count is 0 until the shown counts arrive, and stays 0 for an ad nobody has viewed yet. */}
            <span className="tkh-ad-views">{fillText(counts?.views === 1 ? labels.viewOne : labels.views, { count: formatIndianCount(counts?.views ?? 0) })}</span>
            {ad.slug ? <SaveButton item={{ id: ad.slug, slug: ad.slug, title: ad.title, place: ad.place, at: 0 }} className="tkh-save" /> : null}
          </span>
        </div>
        <Link className="tkh-ad-more" href={ad.href} prefetch={false}>
          {labels.view}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </article>
  );
}
