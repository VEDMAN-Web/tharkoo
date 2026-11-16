"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { fillText } from "@/lib/ui/text";
import type { HomeAdCardData, HomeAdLabels } from "./HomeAdCard";

const SIDE_GROW_PX = 34;
const TOP_GROW_PX = 28;
const EDGE_PX = 8;

export function HomeAdPopout({
  ad,
  labels,
  anchor,
  online,
  onEnter,
  onLeave,
}: {
  ad: HomeAdCardData;
  labels: HomeAdLabels;
  anchor: DOMRect;
  online: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [top, setTop] = useState(anchor.top - TOP_GROW_PX);
  const width = anchor.width + SIDE_GROW_PX * 2;
  const left = Math.min(Math.max(anchor.left - SIDE_GROW_PX, EDGE_PX), window.innerWidth - width - EDGE_PX);
  const photos = ad.photos;
  const current = photos[index] ?? null;

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
        {current ? <img src={current} alt="" draggable={false} /> : <span className="tkh-ad-empty" />}
        {photos.length > 1 ? (
          <span className="tkh-ad-count" aria-hidden="true">{index + 1}/{photos.length}</span>
        ) : null}
        {ad.slug ? (
          <SaveButton item={{ id: ad.slug, slug: ad.slug, title: ad.title, place: ad.city, photo: photos[0] ?? null, at: 0 }} className="tkh-heart" />
        ) : null}
        {photos.length > 1 ? (
          <>
            <button type="button" className="tkh-photo-arrow is-prev is-shown" aria-label={labels.photoPrev} disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button type="button" className="tkh-photo-arrow is-next is-shown" aria-label={labels.photoNext} disabled={index >= photos.length - 1} onClick={() => setIndex((value) => Math.min(photos.length - 1, value + 1))}>
              <ChevronRight size={16} aria-hidden />
            </button>
            <div className="tkh-pop-thumbs">
              {photos.slice(0, 5).map((src, position) => (
                <button key={src + position} type="button" className={position === index ? "is-on" : undefined} aria-label={`${position + 1}`} onClick={() => setIndex(position)}>
                  <img src={src} alt="" draggable={false} />
                </button>
              ))}
            </div>
          </>
        ) : null}
        <span className="tkh-ad-watermark" aria-hidden>{labels.watermark}</span>
      </div>
      <div className="tkh-pop-body">
        <p className="tkh-pop-title">{ad.title}</p>
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
        <div className="tkh-pop-acts">
          <Link href={ad.href} prefetch={false} className="tkh-pop-btn">{labels.chat}</Link>
          <Link href={ad.href} prefetch={false} className="tkh-pop-btn is-main">{labels.viewAd}</Link>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
