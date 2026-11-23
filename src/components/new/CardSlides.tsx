"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { adPhotoAlt } from "@/lib/ad-photo-alt";
import type { CardSlide } from "./card-slides";

/** The scroll track of photo and video slides, shared by the Home card and the listing row card. */
export function SlideTrack({
  slides,
  href,
  trackRef,
  videoRef,
  onScroll,
  onTouch,
  onClicked,
  title,
  place,
  eager,
}: {
  slides: CardSlide[];
  href: string;
  trackRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  onScroll: () => void;
  onTouch: () => void;
  onClicked?: () => void;
  /** The ad title and the area or city: each photo adds its own number to the alt text (H17.6). */
  title: string;
  place: string;
  /** The card is in the first row: its first photo loads at once, every other photo waits (H17.6). */
  eager: boolean;
}) {
  let photoNumber = 0;
  return (
    <div className="tkh-ad-track" ref={trackRef} onScroll={onScroll} onPointerDown={onTouch} onWheel={onTouch}>
      {slides.length ? (
        slides.map((slide, position) => {
          const number = slide.kind === "image" ? (photoNumber += 1) : 0;
          return (
          <Link key={slide.src + position} href={href} prefetch={false} className={slide.kind === "video" ? "tkh-ad-slide tkh-ad-videoslide" : "tkh-ad-slide"} tabIndex={-1} aria-hidden="true" data-ad-link onClick={onClicked}>
            {slide.kind === "video" ? (
              <video ref={videoRef} src={slide.src} poster={slide.poster ?? undefined} muted playsInline preload="none" data-tk="card-video" />
            ) : (
              <img src={slide.src} alt={adPhotoAlt(title, place, number)} width={400} height={500} loading={eager && number === 1 ? "eager" : "lazy"} decoding="async" draggable={false} />
            )}
          </Link>
          );
        })
      ) : (
        <Link href={href} prefetch={false} className="tkh-ad-slide tkh-ad-empty" tabIndex={-1} aria-hidden="true" data-ad-link onClick={onClicked} />
      )}
    </div>
  );
}

/** Previous and next arrows plus the dots, only when there is more than one slide. */
export function SlideNav({
  slides,
  index,
  photoPrev,
  photoNext,
  onStep,
}: {
  slides: CardSlide[];
  index: number;
  photoPrev: string;
  photoNext: string;
  onStep: (direction: 1 | -1) => void;
}) {
  if (slides.length < 2) return null;
  return (
    <>
      <button type="button" className="tkh-photo-arrow is-prev" aria-label={photoPrev} onClick={() => onStep(-1)}>
        <ChevronLeft size={16} aria-hidden />
      </button>
      <button type="button" className="tkh-photo-arrow is-next" aria-label={photoNext} onClick={() => onStep(1)}>
        <ChevronRight size={16} aria-hidden />
      </button>
      <div className="tkh-ad-dots" aria-hidden="true">
        {slides.map((slide, position) => (
          <i key={slide.src + position} className={position === index ? "is-on" : undefined} />
        ))}
      </div>
    </>
  );
}
