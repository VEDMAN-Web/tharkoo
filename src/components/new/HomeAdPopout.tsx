"use client";

import { useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { recordAdClick } from "@/components/ad/adCountStore";
import { SaveButton } from "@/components/ui/SaveButton";
import { fillText } from "@/lib/ui/text";
import type { HomeAdCardData, HomeAdLabels } from "./HomeAdCard";
import type { CardSlide } from "./card-slides";

const SIDE_GROW_PX = 34;
const TOP_GROW_PX = 28;
const EDGE_PX = 8;

export function HomeAdPopout({
  ad,
  labels,
  anchor,
  online,
  chatOn = false,
  slides,
  index,
  onIndex,
  videoRef,
  onEnter,
  onLeave,
}: {
  ad: HomeAdCardData;
  labels: HomeAdLabels;
  anchor: DOMRect;
  online: boolean;
  /** H7.131: the advertiser takes live chat, so Chat opens it on the ad page. */
  chatOn?: boolean;
  slides: CardSlide[];
  index: number;
  onIndex: (position: number) => void;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(anchor.top - TOP_GROW_PX);
  const width = anchor.width + SIDE_GROW_PX * 2;
  const left = Math.min(Math.max(anchor.left - SIDE_GROW_PX, EDGE_PX), window.innerWidth - width - EDGE_PX);
  const photos = ad.photos;
  const current = slides[index] ?? null;
  const posterOf = (slide: CardSlide) => (slide.kind === "video" ? slide.poster : slide.src);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.getBoundingClientRect().height;
    const wanted = anchor.top - TOP_GROW_PX;
    setTop(Math.max(EDGE_PX, Math.min(wanted, window.innerHeight - height - EDGE_PX)));
  }, [anchor, index]);

  const body = (
    <div
      ref={ref}
      className="tkh-pop"
      role="group"
      aria-label={ad.title}
      data-tk="home-ad-popout"
      style={{ left, top, width }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <div className="tkh-pop-photo">
        {current?.kind === "video" ? (
          <video ref={videoRef} src={current.src} poster={current.poster ?? undefined} muted playsInline preload="none" data-tk="popout-video" />
        ) : current ? (
          <img src={current.src} alt="" draggable={false} />
        ) : (
          <span className="tkh-ad-empty" />
        )}
        {slides.length > 1 ? (
          <span className="tkh-ad-count" aria-hidden="true">{index + 1}/{slides.length}</span>
        ) : null}
        {ad.slug ? (
          <SaveButton item={{ id: ad.slug, slug: ad.slug, title: ad.title, place: ad.city, photo: photos[0] ?? null, at: 0 }} className="tkh-heart" />
        ) : null}
        {slides.length > 1 ? (
          <>
            <button type="button" className="tkh-photo-arrow is-prev is-shown" aria-label={labels.photoPrev} onClick={() => onIndex((index - 1 + slides.length) % slides.length)}>
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button type="button" className="tkh-photo-arrow is-next is-shown" aria-label={labels.photoNext} onClick={() => onIndex((index + 1) % slides.length)}>
              <ChevronRight size={16} aria-hidden />
            </button>
            <div className="tkh-pop-thumbs">
              {slides.slice(0, 5).map((slide, position) => (
                <button key={slide.src + position} type="button" className={position === index ? "is-on" : undefined} aria-label={`${position + 1}`} onClick={() => onIndex(position)}>
                  {posterOf(slide) ? <img src={posterOf(slide) ?? ""} alt="" draggable={false} /> : null}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <span className="tkh-ad-watermark" aria-hidden>{labels.watermark}</span>
      </div>
      <div className="tkh-pop-body">
        <p className="tkh-pop-title">
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
        {ad.description ? <p className="tkh-pop-desc">{ad.description}</p> : null}
        <p className="tkh-ad-pills">
          <Link href={ad.categoryHref} prefetch={false} className="tkh-pill tkh-pill-rose">{ad.categoryName}</Link>
          {ad.city ? <Link href={ad.cityHref} prefetch={false} className="tkh-pill tkh-pill-lavender">{ad.city}</Link> : null}
        </p>
        {chatOn ? (
          <div className="tkh-pop-acts">
            <Link href={`${ad.href}${ad.href.includes("?") ? "&" : "?"}chat=1`} prefetch={false} className="tkh-pop-btn" data-tk="pop-chat">{labels.chat}</Link>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
