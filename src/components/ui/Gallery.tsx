"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { safePhoto } from "@/lib/media";
import { SmartImage } from "./SmartImage";
import { PlaceholderArt } from "./PlaceholderArt";
import { useFocusTrap } from "./useFocusTrap";

export function Gallery({
  photos,
  title,
  seed,
  category,
}: {
  photos: (string | null | undefined)[];
  title: string;
  seed: string;
  category?: string;
}) {
  const items = photos.map((photo) => safePhoto(photo)).filter((photo): photo is string => Boolean(photo));
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const ref = useFocusTrap(open, () => setOpen(false));

  if (!items.length) {
    return (
      <div data-tk="gallery">
        <div className="tk-tile" style={{ minHeight: 220 }}>
          <PlaceholderArt seed={seed} category={category} decorative />
        </div>
        <p className="t-small" style={{ color: "var(--muted)" }}>No photos yet</p>
      </div>
    );
  }

  const current = Math.min(index, items.length - 1);
  const many = items.length > 1;
  const go = (step: number) => setIndex((value) => (value + step + items.length) % items.length);

  return (
    <div data-tk="gallery">
      <div className="tk-gal">
        <div
          className="tk-gal-main"
          onTouchStart={(event) => {
            touchX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchX.current;
            touchX.current = null;
            const end = event.changedTouches[0]?.clientX;
            if (start === null || end === undefined || Math.abs(end - start) < 40) return;
            go(end < start ? 1 : -1);
          }}
        >
          <button type="button" className="tk-gal-open" onClick={() => setOpen(true)} aria-label="Open all photos">
            <SmartImage
              src={items[current]}
              alt={`${title}, photo ${current + 1} of ${items.length}`}
              seed={`${seed}-${current}`}
              category={category}
              width={800}
              height={1000}
              sizes="(max-width: 767px) 100vw, 760px"
              priority={current === 0}
              fit="contain"
            />
          </button>
          {many ? (
            <>
              <button type="button" className="tk-gal-nav prev" aria-label="Previous photo" onClick={() => go(-1)}>
                <ChevronLeft size={20} />
              </button>
              <button type="button" className="tk-gal-nav next" aria-label="Next photo" onClick={() => go(1)}>
                <ChevronRight size={20} />
              </button>
              <span className="tk-gal-count" aria-live="polite">{current + 1}/{items.length}</span>
            </>
          ) : null}
          <button type="button" className="tk-btn tk-btn-outline-gold tk-show-all" data-tk="show-all" onClick={() => setOpen(true)}>
            SHOW ALL
          </button>
        </div>
        {many ? (
          <div className="tk-gal-thumbs">
            {items.slice(0, 8).map((photo, position) => (
              <button
                key={photo + position}
                type="button"
                className="tk-thumb"
                aria-label={`Show photo ${position + 1}`}
                aria-current={position === current}
                onClick={() => setIndex(position)}
              >
                <SmartImage src={photo} alt="" seed={`${seed}-t${position}`} category={category} width={80} height={100} sizes="80px" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {open ? (
        <div className="tk-sheet" role="dialog" aria-modal="true" aria-label="Photos" ref={ref}>
          <button type="button" className="tk-sheet-back" onClick={() => setOpen(false)}>
            &lt; Back
          </button>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {items.map((photo, position) => (
              <SmartImage key={photo + position} src={photo} alt={`${title}, photo ${position + 1} of ${items.length}`} seed={`${seed}-full-${position}`} category={category} width={800} height={600} sizes="100vw" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
