"use client";

import { useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, Eye, Hand } from "lucide-react";
import { recordAdClick, useShownCounts } from "@/components/ad/adCountStore";
import { formatIndianCount } from "@/components/ad/counts-format";
import { SaveButton } from "@/components/ui/SaveButton";
import { fillText } from "@/lib/ui/text";
import { PopPhoto } from "./HomeAdPopout";
import type { CardSlide } from "./card-slides";
import type { ListingRowData, RowLabels } from "./listing-row-data";
import type { ListingRowLabels } from "./ListingRow";

const GROW_PX = 28;
const EDGE_PX = 8;
const MIN_WIDTH_PX = 720;

function countText(count: number, one: string, many: string) {
  return fillText(count === 1 ? one : many, { count: formatIndianCount(count) });
}

/**
 * H14.1b: the hover pop-out of a listing row, laid out sideways: the bigger photo on the left with its thumbnails and arrows,
 * the full text on the right. It sits in a portal over the row (no layout shift), grows outward from the row with scale and
 * opacity only, stays inside the window, and the whole pop-out opens the ad through the stretched title link (H14.2).
 */
export function ListingPopout({
  ad,
  labels,
  row,
  anchor,
  online,
  chatOn,
  slides,
  index,
  onIndex,
  videoRef,
  onEnter,
  onLeave,
}: {
  ad: ListingRowData;
  labels: ListingRowLabels;
  row: RowLabels;
  anchor: DOMRect;
  online: boolean;
  chatOn: boolean;
  slides: CardSlide[];
  index: number;
  onIndex: (position: number) => void;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(anchor.top - GROW_PX);
  const counts = useShownCounts(ad.slug);
  const width = Math.min(Math.max(anchor.width + GROW_PX * 2, MIN_WIDTH_PX), window.innerWidth - EDGE_PX * 2);
  const left = Math.min(Math.max(anchor.left - GROW_PX, EDGE_PX), window.innerWidth - width - EDGE_PX);
  const place = ad.area ? `${ad.city}, ${ad.area}` : ad.city;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.getBoundingClientRect().height;
    const wanted = anchor.top + anchor.height / 2 - height / 2;
    setTop(Math.max(EDGE_PX, Math.min(wanted, window.innerHeight - height - EDGE_PX)));
  }, [anchor, index]);

  const originX = anchor.left + anchor.width / 2 - left;
  const originY = anchor.top + anchor.height / 2 - top;

  const body = (
    <div
      ref={ref}
      className="tkh-pop tk-pop"
      role="group"
      aria-label={ad.title}
      data-tk="listing-popout"
      style={{ left, top, width, transformOrigin: `${originX}px ${originY}px` }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <PopPhoto ad={ad} labels={labels} slides={slides} index={index} onIndex={onIndex} videoRef={videoRef} heart={false} />
      <div className="tkh-pop-body tk-pop-body">
        <p className="tkh-pop-title tk-pop-title">
          <Link href={ad.href} prefetch={false} className="tkh-pop-link" onClick={() => (ad.slug ? recordAdClick(ad.slug) : undefined)}>
            {ad.title}
          </Link>
        </p>
        {online || ad.age ? (
          <p className="tkh-pop-meta">
            {online ? <span className="is-online">● {labels.online}</span> : null}
            {ad.age ? <span>{fillText(labels.age, { age: ad.age })}</span> : null}
          </p>
        ) : null}
        {ad.description ? <p className="tk-pop-desc">{ad.description}</p> : null}
        <p className="tk-pop-tags">
          {ad.verified ? (
            <span className="tk-row-tag is-ok">
              <Check size={12} aria-hidden />
              {row.photoVerified}
            </span>
          ) : null}
          <Link href={ad.categoryHref} prefetch={false} className="tk-row-tag is-cat">{ad.categoryName}</Link>
          {place ? <Link href={ad.cityHref} prefetch={false} className="tk-row-tag is-place">{place}</Link> : null}
        </p>
        <div className="tk-pop-foot">
          {ad.showPrice && ad.price ? <span className="tk-row-price">{ad.price}</span> : null}
          <span className="tk-row-stats" data-ready={counts ? "true" : "false"}>
            <span className="tk-row-stat">
              <Eye size={15} aria-hidden />
              {countText(counts?.views ?? 0, row.viewOne, row.views)}
            </span>
            <span className="tk-row-stat">
              <Hand size={15} aria-hidden />
              {countText(counts?.clicks ?? 0, row.clickOne, row.clicks)}
            </span>
          </span>
        </div>
        <div className="tkh-pop-acts tk-pop-acts">
          {chatOn ? <Link href={`${ad.href}${ad.href.includes("?") ? "&" : "?"}chat=1`} prefetch={false} className="tkh-pop-btn" data-tk="pop-chat">{labels.chat}</Link> : null}
          {ad.slug ? (
            <SaveButton item={{ id: ad.slug, slug: ad.slug, title: ad.title, place, photo: ad.photos[0] ?? null, at: 0 }} className="tkh-pop-btn tk-pop-save" label={row.saveAd} />
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
