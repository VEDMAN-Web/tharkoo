"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { Camera, Check } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { useSellerStatus } from "@/components/availability/sellerStatus";
import { makeT } from "@/lib/ui/text";
import { AdCardCounts } from "./AdCardCounts";
import type { HomeAdLabels } from "./HomeAdCard";
import { cardSlides } from "./card-slides";
import { SlideNav, SlideTrack } from "./CardSlides";
import { rowLabels, type ListingRowData, type RowLabels } from "./listing-row-data";
import { ListingPopout } from "./ListingPopout";
import { useCardHover } from "./use-card-hover";
import { useCardSlider } from "./use-card-slider";
import "./home-ads.css";
import "./listing-grid.css";

const HOVER_DELAY_MS = 150;
const POPOUT_MIN_WIDTH_PX = 768;
const DEFAULT_ROW_LABELS = rowLabels(makeT());

export type ListingRowLabels = HomeAdLabels & { row?: RowLabels };

function tierText(tier: ListingRowData["tier"], row: RowLabels) {
  if (tier === "new") return row.tierNew;
  if (tier === "top") return row.tierTop;
  if (tier === "supertop") return row.tierSuperTop;
  if (tier === "featured") return row.tierFeatured;
  return "";
}

/**
 * H14.1: the listing card in the approved design: a row with the photo on the left and the text on the right.
 * Used everywhere except the Home page. The photo slider and video are the Home card's (use-card-slider).
 */
export function ListingRow({ ad, labels, order = 0, eager = false }: { ad: ListingRowData; labels: ListingRowLabels; order?: number; eager?: boolean }) {
  const row = labels.row ?? DEFAULT_ROW_LABELS;
  const seller = useSellerStatus(ad.slug || undefined);
  const photos = ad.photos;
  const slides = useMemo(() => cardSlides(photos, ad.videoUrl, ad.videoPoster), [photos, ad.videoUrl, ad.videoPoster]);
  // H17.1: a sample ad is not online and has no chat: nobody is behind it.
  const online = !ad.sample && Boolean(seller && seller.chatOn && seller.status === "online");
  const cardRef = useRef<HTMLElement>(null);
  const popVideoRef = useRef<HTMLVideoElement | null>(null);
  const { anchor, cardHandlers, popHandlers } = useCardHover(cardRef, HOVER_DELAY_MS, POPOUT_MIN_WIDTH_PX);
  const { trackRef, videoRef, index, setIndex, calm, onScroll, step } = useCardSlider({ cardRef, slug: ad.slug, slides, order, anchored: Boolean(anchor), popVideoRef });
  const tier = tierText(ad.tier, row);
  const place = ad.area ? `${ad.city}, ${ad.area}` : ad.city;

  return (
    <article ref={cardRef} className={anchor ? "tk-row is-open" : "tk-row"} data-tk="listing-row" data-slide={index} data-tier={ad.tier || undefined} {...cardHandlers}>
      <div className="tk-row-photo">
        <SlideTrack slides={slides} href={ad.href} trackRef={trackRef} videoRef={videoRef} onScroll={onScroll} onTouch={calm} title={ad.title} place={ad.area || ad.city} eager={eager} />
        {tier ? <span className="tk-row-tier" data-tier={ad.tier}>{tier}</span> : null}
        {slides.length ? (
          <span className="tk-row-count" data-tk="row-media-count" aria-hidden="true">
            <Camera size={12} aria-hidden />
            {slides.length}
          </span>
        ) : null}
        <SlideNav slides={slides} index={index} photoPrev={labels.photoPrev} photoNext={labels.photoNext} onStep={step} />
        {online ? (
          <span className="tkh-ad-online tk-row-online" data-tk="availability" data-status="online">
            <span aria-hidden />
            {labels.online}
          </span>
        ) : null}
        <span className="tk-row-mark" aria-hidden>{labels.watermark}</span>
      </div>
      <div className="tk-row-body">
        <div className="tk-row-titlerow">
          <h3 className="tk-row-title">
            <Link href={ad.href} prefetch={false} className="tkh-ad-link" data-ad-link>
              {ad.title}
            </Link>
          </h3>
          {ad.slug ? (
            <SaveButton item={{ id: ad.slug, slug: ad.slug, title: ad.title, place, photo: photos[0] ?? null, at: 0 }} className="tk-row-save" />
          ) : null}
        </div>
        {ad.description ? <p className="tk-row-desc" data-tk="row-desc">{ad.description}</p> : null}
        <div className="tk-row-foot">
          <div className="tk-row-foot-main">
            <p className="tk-row-tags">
              {ad.sample && labels.sample ? <span className="tk-row-tag is-sample" data-tk="sample-pill">{labels.sample}</span> : null}
              {ad.verified ? (
                <span className="tk-row-tag is-ok" data-tk="row-verified">
                  <Check size={12} aria-hidden />
                  {row.photoVerified}
                </span>
              ) : null}
              <Link href={ad.categoryHref} prefetch={false} className="tk-row-tag is-cat">{ad.categoryName}</Link>
              {place ? <Link href={ad.cityHref} prefetch={false} className="tk-row-tag is-place">{place}</Link> : null}
            </p>
          </div>
          <AdCardCounts slug={ad.slug} labels={{ views: row.views, viewOne: row.viewOne, clicks: row.clicks, clickOne: row.clickOne }} />
        </div>
      </div>
      {anchor ? (
        <ListingPopout
          ad={ad}
          labels={labels}
          row={row}
          anchor={anchor}
          online={online}
          chatOn={!ad.sample && Boolean(seller?.chatOn)}
          slides={slides}
          index={index}
          onIndex={(position) => {
            calm();
            setIndex(position);
          }}
          videoRef={popVideoRef}
          onEnter={popHandlers.onEnter}
          onLeave={popHandlers.onLeave}
        />
      ) : null}
    </article>
  );
}
