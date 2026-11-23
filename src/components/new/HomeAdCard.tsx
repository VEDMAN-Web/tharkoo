"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { SaveButton } from "@/components/ui/SaveButton";
import { recordAdClick } from "@/components/ad/adCountStore";
import { useSellerStatus } from "@/components/availability/sellerStatus";
import { HomeAdPopout } from "./HomeAdPopout";
import { cardSlides } from "./card-slides";
import { SlideNav, SlideTrack } from "./CardSlides";
import { useCardHover } from "./use-card-hover";
import { useCardSlider } from "./use-card-slider";
import "./home-ads.css";

export type HomeAdCardData = {
  slug: string;
  title: string;
  photos: string[];
  videoUrl?: string | null;
  videoPoster?: string | null;
  description: string;
  age: number | null;
  categoryName: string;
  categoryHref: string;
  city: string;
  cityHref: string;
  href: string;
  /** A sample (demo) ad: it shows a Sample ad label. */
  sample?: boolean;
};

export type HomeAdLabels = {
  online: string;
  watermark: string;
  photoPrev: string;
  photoNext: string;
  chat: string;
  age: string;
  sample?: string;
};

const HOVER_DELAY_MS = 150;

export function HomeAdCard({ ad, labels, order = 0, eager = false }: { ad: HomeAdCardData; labels: HomeAdLabels; order?: number; eager?: boolean }) {
  const cardRef = useRef<HTMLElement>(null);
  const popVideoRef = useRef<HTMLVideoElement | null>(null);
  const seller = useSellerStatus(ad.slug || undefined);
  const { anchor, cardHandlers, popHandlers } = useCardHover(cardRef, HOVER_DELAY_MS);
  const photos = ad.photos;
  const slides = useMemo(() => cardSlides(photos, ad.videoUrl, ad.videoPoster), [photos, ad.videoUrl, ad.videoPoster]);
  // H17.1: a sample ad is not online and has no chat: nobody is behind it.
  const online = !ad.sample && Boolean(seller && seller.chatOn && seller.status === "online");
  const { trackRef, videoRef, index, setIndex, calm, onScroll, step } = useCardSlider({ cardRef, slug: ad.slug, slides, order, anchored: Boolean(anchor), popVideoRef });

  const clicked = () => {
    if (ad.slug) recordAdClick(ad.slug);
  };

  return (
    <article
      ref={cardRef}
      className={anchor ? "tkh-ad is-lifted m-lift" : "tkh-ad m-lift"}
      data-tk="home-ad"
      data-slide={index}
      {...cardHandlers}
      onPointerEnter={(event) => {
        // Start loading the pop-out's pictures as soon as the mouse is over the card, so they are there when the pop-out opens.
        if (event.pointerType === "mouse") {
          slides.slice(0, 5).forEach((slide) => {
            const url = slide.kind === "video" ? slide.poster : slide.src;
            if (url) new window.Image().src = url;
          });
        }
        cardHandlers.onPointerEnter(event);
      }}
    >
      <div className="tkh-ad-photo">
        <SlideTrack slides={slides} href={ad.href} trackRef={trackRef} videoRef={videoRef} onScroll={onScroll} onTouch={calm} onClicked={clicked} title={ad.title} place={ad.city} eager={eager} />
        {slides.length > 1 ? <span className="tkh-ad-count" aria-hidden="true">{index + 1}/{slides.length}</span> : null}
        {ad.slug ? (
          <SaveButton item={{ id: ad.slug, slug: ad.slug, title: ad.title, place: ad.city, photo: photos[0] ?? null, at: 0 }} className="tkh-heart" />
        ) : null}
        <SlideNav slides={slides} index={index} photoPrev={labels.photoPrev} photoNext={labels.photoNext} onStep={step} />
        {online ? (
          <span className="tkh-ad-online" data-tk="availability" data-status="online">
            <span aria-hidden />
            {labels.online}
          </span>
        ) : null}
        <span className="tkh-ad-watermark" aria-hidden>{labels.watermark}</span>
      </div>
      <div className="tkh-ad-body">
        <h3 className="tkh-ad-title">
          <Link href={ad.href} prefetch={false} className="tkh-ad-link" onClick={clicked} data-ad-link>
            {ad.title}
          </Link>
        </h3>
        <p className="tkh-ad-pills">
          {ad.sample && labels.sample ? <span className="tkh-pill tkh-pill-sample" data-tk="sample-pill">{labels.sample}</span> : null}
          <Link href={ad.categoryHref} prefetch={false} className="tkh-pill tkh-pill-rose">{ad.categoryName}</Link>
          {ad.city ? (
            <Link href={ad.cityHref} prefetch={false} className="tkh-pill tkh-pill-lavender">{ad.city}</Link>
          ) : null}
        </p>
      </div>
      {anchor ? (
        <HomeAdPopout
          ad={ad}
          labels={labels}
          anchor={anchor}
          online={online}
          chatOn={Boolean(seller?.chatOn)}
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
