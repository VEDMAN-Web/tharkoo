"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { safePhoto } from "@/lib/media";
import { SmartImage } from "./SmartImage";
import { PlaceholderArt } from "./PlaceholderArt";
import { useFocusTrap } from "./useFocusTrap";

const SLIDE_MS = 250;
const SWIPE_PX = 40;
const wrap = (value: number, size: number) => ((value % size) + size) % size;

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
  const [lightIndex, setLightIndex] = useState(0);
  const [start, setStart] = useState(0);
  const [shift, setShift] = useState(0);
  const [perView, setPerView] = useState(3);
  const drag = useRef({ x: 0, moved: false });
  const lightX = useRef<number | null>(null);
  const ref = useFocusTrap(open, () => setOpen(false));
  const size = items.length;

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setPerView(query.matches ? 3 : 1);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setLightIndex((value) => wrap(value + 1, size));
      if (event.key === "ArrowLeft") setLightIndex((value) => wrap(value - 1, size));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, size]);

  if (!size) {
    return (
      <div data-tk="gallery">
        <div className="tk-tile" style={{ minHeight: 220 }}>
          <PlaceholderArt seed={seed} category={category} decorative />
        </div>
        <p className="t-small" style={{ color: "var(--muted)" }}>No photos yet</p>
      </div>
    );
  }

  const loops = size > perView;
  const go = (step: number) => {
    if (!loops || shift !== 0) return;
    setShift(step);
    window.setTimeout(() => {
      setStart((value) => wrap(value + step, size));
      setShift(0);
    }, SLIDE_MS);
  };
  const slots = loops ? Array.from({ length: perView + 2 }, (_, i) => wrap(start - 1 + i, size)) : items.map((_, i) => i);
  const lightGo = (step: number) => setLightIndex((value) => wrap(value + step, size));
  const alt = (index: number) => `${title}, photo ${index + 1} of ${size}`;

  return (
    <div data-tk="gallery">
      <div className="tk-strip" data-count={size}>
        <div
          className="tk-strip-view"
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, moved: false };
          }}
          onPointerMove={(event) => {
            if (Math.abs(event.clientX - drag.current.x) > 8) drag.current.moved = true;
          }}
          onPointerUp={(event) => {
            const dx = event.clientX - drag.current.x;
            if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
          }}
        >
          <div
            className={`tk-strip-track${shift ? " is-sliding" : ""}`}
            style={{ ["--k" as string]: loops ? 1 + shift : 0 }}
          >
            {slots.map((index, slot) => (
              <button
                key={`${slot}-${index}`}
                type="button"
                className="tk-strip-tile"
                aria-label={`Open photo ${index + 1} of ${size}`}
                onClick={() => {
                  if (drag.current.moved) return;
                  setLightIndex(index);
                  setOpen(true);
                }}
              >
                <SmartImage
                  src={items[index]}
                  alt={alt(index)}
                  seed={`${seed}-${index}`}
                  category={category}
                  width={400}
                  height={500}
                  sizes="(max-width: 767px) 88vw, 300px"
                  priority={index === 0 && slot <= 1}
                />
              </button>
            ))}
          </div>
        </div>
        {loops ? (
          <>
            <button type="button" className="tk-gal-nav prev" aria-label="Previous photo" onClick={() => go(-1)}>
              <ChevronLeft size={20} />
            </button>
            <button type="button" className="tk-gal-nav next" aria-label="Next photo" onClick={() => go(1)}>
              <ChevronRight size={20} />
            </button>
          </>
        ) : null}
        {size > 1 ? (
          <div className="tk-strip-dots">
            {items.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Show photo ${index + 1}`}
                aria-current={wrap(start, size) === index}
                onClick={() => setStart(index)}
              />
            ))}
          </div>
        ) : null}
      </div>
      {open ? (
        <div className="tk-light" role="dialog" aria-modal="true" aria-label="Photos" ref={ref}>
          <span className="tk-light-count" aria-live="polite">{lightIndex + 1} / {size}</span>
          <button type="button" className="tk-light-x" aria-label="Close photos" onClick={() => setOpen(false)}>
            <X size={24} />
          </button>
          <div
            className="tk-light-stage"
            onTouchStart={(event) => {
              lightX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              const from = lightX.current;
              lightX.current = null;
              const to = event.changedTouches[0]?.clientX;
              if (from === null || to === undefined || Math.abs(to - from) < SWIPE_PX) return;
              lightGo(to < from ? 1 : -1);
            }}
          >
            {(size > 1 ? [-1, 0, 1] : [0]).map((offset) => {
              const index = wrap(lightIndex + offset, size);
              return (
                <div key={offset} className="tk-light-slide" data-current={offset === 0}>
                  <SmartImage
                    src={items[index]}
                    alt={offset === 0 ? alt(index) : ""}
                    seed={`${seed}-L${index}`}
                    category={category}
                    width={1000}
                    height={1250}
                    sizes="100vw"
                    priority={size > 1}
                    fit="contain"
                  />
                </div>
              );
            })}
          </div>
          {size > 1 ? (
            <>
              <button type="button" className="tk-light-nav prev" aria-label="Previous photo" onClick={() => lightGo(-1)}>
                <ChevronLeft size={28} />
              </button>
              <button type="button" className="tk-light-nav next" aria-label="Next photo" onClick={() => lightGo(1)}>
                <ChevronRight size={28} />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
