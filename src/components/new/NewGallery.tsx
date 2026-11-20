"use client";

import { useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Play } from "lucide-react";
import { useContact } from "@/components/ContactButtons";
import { useT } from "@/components/ui/AdCard";
import { adPhotoAlt } from "@/lib/ad-photo-alt";
import type { AdVideo } from "@/server/media/video";
import { buildGalleryItems, wrapIndex } from "./gallery-items";
import { GalleryVideo } from "./GalleryVideo";
import { GalleryViewer } from "./GalleryViewer";
import "./gallery.css";

const SWIPE_DISTANCE = 40;

export function NewGallery({ photos, videos = [], title, place = "", badge, isNew = false }: { photos: string[]; videos?: AdVideo[]; title: string; place?: string; badge?: string | null; isNew?: boolean }) {
  const t = useT();
  const { seller } = useContact();
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState(false);
  const touchX = useRef<number | null>(null);
  const items = buildGalleryItems(videos, photos);
  const count = items.length;
  if (!count) {
    return <div className="tkn-gal tkn-gal-empty" aria-hidden="true" />;
  }
  const at = Math.min(index, count - 1);
  const current = items[at];
  const videoTotal = videos.length;
  const go = (next: number) => setIndex(wrapIndex(next, count));

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(at - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(at + 1);
    }
  }

  function onTouchStart(event: TouchEvent) {
    touchX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touchX.current;
    touchX.current = null;
    const end = event.changedTouches[0]?.clientX;
    if (start === null || end === undefined || count < 2) return;
    const delta = end - start;
    if (Math.abs(delta) >= SWIPE_DISTANCE) go(delta < 0 ? at + 1 : at - 1);
  }

  const label = (kind: "photo" | "video", position: number) =>
    kind === "video" ? t("ad.gallery.video", { index: position, count: videoTotal }) : t("ad.gallery.photo", { index: position - videoTotal, count: count - videoTotal });

  return (
    <div className="tkn-gallery" data-tk="gallery">
      <figure
        className="tkn-gal"
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={t("ad.gallery.region")}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="tkn-gal-main">
          {current.kind === "photo" ? (
            <>
              <img className="tkn-gal-blur" src={current.src} alt="" aria-hidden="true" width={960} height={1200} />
              <img className="tkn-gal-img" src={current.src} alt={adPhotoAlt(title, place, at + 1 - videoTotal)} width={960} height={1200} decoding="async" />
            </>
          ) : (
            <GalleryVideo key={current.src} item={current} active label={`${title}, ${label("video", at + 1)}`} />
          )}
        </div>
        <span className="tkn-gal-badges">
          {isNew ? <span className="tkn-gal-new">New</span> : null}
          {badge ? <span className="tkn-gal-badge">{badge}</span> : null}
          {seller?.chatOn && seller.status === "online" ? <span className="tkn-gal-live">{t("ad.seller.online")}</span> : null}
        </span>
        {count > 1 ? <span className="tkn-gal-counter" data-tk="gallery-counter" aria-live="polite">{t("ad.gallery.counter", { index: at + 1, count })}</span> : null}
        <button type="button" className="tkn-gal-expand" aria-label={t("ad.gallery.fullscreen")} data-tk="gallery-expand" onClick={() => setViewing(true)}>
          <Maximize2 size={18} aria-hidden />
        </button>
        {current.kind === "photo" ? <span className="tkn-gal-wm" aria-hidden="true">tharkoo.com</span> : null}
        {count > 1 ? (
          <>
            <button type="button" className="tkn-gal-nav is-prev" aria-label={t("ad.gallery.prev")} data-tk="gallery-prev" onClick={() => go(at - 1)}>
              <ChevronLeft size={22} aria-hidden />
            </button>
            <button type="button" className="tkn-gal-nav is-next" aria-label={t("ad.gallery.next")} data-tk="gallery-next" onClick={() => go(at + 1)}>
              <ChevronRight size={22} aria-hidden />
            </button>
          </>
        ) : null}
      </figure>
      {count > 1 ? (
        <ul className="tkn-thumbs" data-tk="gallery-thumbs">
          {items.map((item, i) => (
            <li key={item.src + i}>
              <button
                type="button"
                className="tkn-thumb"
                aria-label={item.kind === "video" ? t("ad.gallery.showVideo", { index: i + 1 }) : t("ad.gallery.show", { index: i - videoTotal + 1 })}
                aria-pressed={i === at}
                onClick={() => setIndex(i)}
              >
                {item.kind === "photo" ? <img src={item.src} alt="" width={120} height={120} loading="lazy" /> : item.poster ? <img src={item.poster} alt="" width={120} height={120} loading="lazy" /> : null}
                {item.kind === "video" ? (
                  <span className="tkn-thumb-play" aria-hidden="true">
                    <Play size={16} />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {viewing ? <GalleryViewer items={items} index={at} title={title} onIndex={setIndex} onClose={() => setViewing(false)} /> : null}
    </div>
  );
}
