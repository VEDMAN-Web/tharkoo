"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { recordAdClick, watchAdCard } from "@/components/ad/adCountStore";
import { useSellerStatus } from "@/components/availability/sellerStatus";
import { formatPrice } from "@/components/search/price";

export type HomeAdCardData = {
  slug: string;
  title: string;
  price?: number | null;
  photo: string | null;
  photos?: string[];
  categoryName: string;
  place: string;
  href: string;
};

const SWIPE_PX = 40;

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
  const touchX = useRef<number | null>(null);
  const seller = useSellerStatus(ad.slug || undefined);
  const price = formatPrice(ad.price);
  const photos = ad.photos?.length ? ad.photos : ad.photo ? [ad.photo] : [];
  const [index, setIndex] = useState(0);
  const step = (delta: number) => setIndex((current) => (current + delta + photos.length) % photos.length);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !ad.slug) return;
    return watchAdCard(el, ad.slug);
  }, [ad.slug]);

  return (
    <article ref={cardRef} className="tkh-ad" data-tk="home-ad">
      <div
        className="tkh-ad-photo"
        onTouchStart={(event) => {
          touchX.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          const start = touchX.current;
          touchX.current = null;
          if (start === null || photos.length < 2) return;
          const dx = event.changedTouches[0].clientX - start;
          if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1);
        }}
      >
        {photos.length ? (
          <img className="tkh-ad-main" src={photos[index]} alt="" width={400} height={260} loading="lazy" />
        ) : (
          <span className="tkh-ad-empty" aria-hidden />
        )}
        {badge ? <span className="tkh-ad-badge">{badge}</span> : null}
        {ad.slug ? <SaveButton item={{ id: ad.slug, slug: ad.slug, title: ad.title, place: ad.place, at: 0 }} className="tkh-save tkh-ad-save" /> : null}
        {seller && seller.chatOn ? (
          <span className={`tkh-ad-status ${seller.status === "online" ? "is-online" : "is-away"}`} data-tk="availability" data-status={seller.status}>
            <span aria-hidden />
            {seller.status === "online" ? labels.online : labels.away}
          </span>
        ) : null}
        {photos.length > 1 ? (
          <>
            <button type="button" className="tkh-ad-arrow is-prev" aria-label="Previous photo" onClick={() => step(-1)}>
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button type="button" className="tkh-ad-arrow is-next" aria-label="Next photo" onClick={() => step(1)}>
              <ChevronRight size={16} aria-hidden />
            </button>
            <span className="tkh-ad-dots">
              {photos.map((_, dot) => (
                <i key={dot} className={dot === index ? "is-on" : undefined} />
              ))}
            </span>
          </>
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
        </div>
        <Link className="tkh-ad-more" href={ad.href} prefetch={false}>
          {labels.view}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </article>
  );
}
