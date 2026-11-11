"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SmartImage } from "./SmartImage";

const MAX_DOTS = 5;
const SWIPE_PX = 40;
const SLIDE_MS = 250;

export function PhotoSwipe({
  photos,
  title,
  seed,
  category,
  priority,
  overlay,
}: {
  photos: string[];
  title: string;
  seed: string;
  category?: string;
  priority?: boolean;
  overlay?: ReactNode;
}) {
  const count = photos.length;
  const [started, setStarted] = useState(false);
  const [pos, setPos] = useState(0);
  const [instant, setInstant] = useState(false);
  const touchX = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  // Slides: the photos plus a clone of the first, so the forward wrap slides instead of jumping.
  const slides = started && count > 1 ? [...photos, photos[0]] : [photos[0]];
  const shown = count > 1 && started ? pos : 0;
  const dot = count <= MAX_DOTS ? shown % count : Math.floor(((shown % count) * MAX_DOTS) / count);

  function go(step: number) {
    if (count < 2) return;
    setStarted(true);
    if (step > 0) {
      setPos((value) => value + 1);
      return;
    }
    if (pos === 0) {
      // Backward wrap: jump to the clone of the first photo, then slide back to the last one.
      setInstant(true);
      setPos(count);
      timer.current = window.setTimeout(() => {
        setInstant(false);
        setPos(count - 1);
      }, 30);
      return;
    }
    setPos((value) => value - 1);
  }

  function onTransitionEnd() {
    if (pos !== count) return;
    setInstant(true);
    setPos(0);
    timer.current = window.setTimeout(() => setInstant(false), 30);
  }

  return (
    <div
      className="tk-cc"
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchX.current;
        touchX.current = null;
        const end = event.changedTouches[0]?.clientX;
        if (start === null || end === undefined || Math.abs(end - start) < SWIPE_PX) return;
        go(end < start ? 1 : -1);
      }}
    >
      <div
        className={`tk-cc-track ${instant ? "is-instant" : ""}`}
        style={{
          width: `${slides.length * 100}%`,
          transform: `translate3d(-${(shown * 100) / slides.length}%, 0, 0)`,
          transitionDuration: `${instant ? 0 : SLIDE_MS}ms`,
        }}
        onTransitionEnd={onTransitionEnd}
      >
        {slides.map((photo, index) => (
          <div className="tk-cc-slide" key={`${photo}-${index}`} style={{ width: `${100 / slides.length}%` }}>
            <SmartImage
              src={photo}
              alt={index === 0 ? title : ""}
              seed={`${seed}-${index}`}
              category={category}
              width={360}
              height={480}
              priority={priority && index === 0}
              sizes="(max-width: 767px) 120px, 180px"
              className="h-full"
            />
          </div>
        ))}
      </div>
      {overlay}
      {count > 1 ? (
        <>
          <button type="button" className="tk-cc-arrow prev" aria-label="Previous photo" onClick={() => go(-1)}>
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button type="button" className="tk-cc-arrow next" aria-label="Next photo" onClick={() => go(1)}>
            <ChevronRight size={18} aria-hidden />
          </button>
          <span className="tk-cc-dots" aria-hidden>
            {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, index) => (
              <i key={index} className={index === dot ? "on" : ""} />
            ))}
          </span>
        </>
      ) : null}
    </div>
  );
}
