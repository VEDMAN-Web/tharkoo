"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useContact } from "@/components/ContactButtons";
import { useT } from "@/components/ui/AdCard";

const THUMB_SLOTS = 8;

export function NewGallery({ photos, title, badge, isNew = false }: { photos: string[]; title: string; badge?: string | null; isNew?: boolean }) {
  const t = useT();
  const { seller } = useContact();
  const [index, setIndex] = useState(0);
  const count = photos.length;
  if (!count) {
    return <div className="tkn-gal tkn-gal-empty" aria-hidden="true" />;
  }
  const current = photos[index] ?? photos[0];
  const step = (delta: number) => setIndex((value) => (value + delta + count) % count);
  return (
    <div className="tkn-gallery">
      <figure className="tkn-gal">
        <div className="tkn-gal-main">
          <img className="tkn-gal-blur" src={current} alt="" aria-hidden="true" loading="lazy" />
          <img className="tkn-gal-img" src={current} alt={`${title}, ${t("ad.gallery.photo", { index: index + 1, count })}`} />
        </div>
        <span className="tkn-gal-badges">
          {isNew ? <span className="tkn-gal-new">New</span> : null}
          {badge ? <span className="tkn-gal-badge">{badge}</span> : null}
          {seller?.chatOn && seller.status === "online" ? <span className="tkn-gal-live">{t("ad.seller.online")}</span> : null}
        </span>
        <span className="tkn-gal-wm" aria-hidden="true">tharkoo.com</span>
        <span className="tkn-gal-counter" aria-hidden="true">{t("ad.gallery.counter", { index: index + 1, count })}</span>
        {count > 1 ? (
          <>
            <button type="button" className="tkn-gal-nav is-prev" aria-label={t("ad.gallery.prev")} onClick={() => step(-1)}>
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button type="button" className="tkn-gal-nav is-next" aria-label={t("ad.gallery.next")} onClick={() => step(1)}>
              <ChevronRight size={20} aria-hidden />
            </button>
          </>
        ) : null}
      </figure>
      <ul className="tkn-thumbs">
        {Array.from({ length: THUMB_SLOTS }, (_, i) => {
          const src = photos[i];
          return (
            <li key={i}>
              {src ? (
                <button type="button" className="tkn-thumb" aria-label={t("ad.gallery.show", { index: i + 1 })} aria-pressed={i === index} onClick={() => setIndex(i)}>
                  <img src={src} alt="" loading="lazy" />
                </button>
              ) : (
                <span className="tkn-thumb tkn-thumb-empty" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
