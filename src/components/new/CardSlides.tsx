"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
}: {
  slides: CardSlide[];
  href: string;
  trackRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  onScroll: () => void;
  onTouch: () => void;
  onClicked: () => void;
}) {
  return (
    <div className="tkh-ad-track" ref={trackRef} onScroll={onScroll} onPointerDown={onTouch} onWheel={onTouch}>
      {slides.length ? (
        slides.map((slide, position) => (
          <Link key={slide.src + position} href={href} prefetch={false} className={slide.kind === "video" ? "tkh-ad-slide tkh-ad-videoslide" : "tkh-ad-slide"} tabIndex={-1} aria-hidden="true" onClick={onClicked}>
            {slide.kind === "video" ? (
              <video ref={videoRef} src={slide.src} poster={slide.poster ?? undefined} muted playsInline preload="none" data-tk="card-video" />
            ) : (
              <img src={slide.src} alt="" width={400} height={500} loading={position === 0 ? "eager" : "lazy"} draggable={false} />
            )}
          </Link>
        ))
      ) : (
        <Link href={href} prefetch={false} className="tkh-ad-slide tkh-ad-empty" tabIndex={-1} aria-hidden="true" onClick={onClicked} />
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
