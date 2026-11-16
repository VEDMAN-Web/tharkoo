"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useT } from "@/components/ui/AdCard";
import { wrapIndex, type GalleryItem } from "./gallery-items";

export function GalleryViewer({ items, index, title, onIndex, onClose }: { items: GalleryItem[]; index: number; title: string; onIndex: (next: number) => void; onClose: () => void }) {
  const t = useT();
  const closeButton = useRef<HTMLButtonElement>(null);
  const count = items.length;
  const item = items[index];

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") onIndex(wrapIndex(index - 1, count));
      else if (event.key === "ArrowRight") onIndex(wrapIndex(index + 1, count));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, count, onIndex, onClose]);

  if (!item) return null;
  return (
    <div className="tkn-viewer" role="dialog" aria-modal="true" aria-label={title} data-tk="gallery-viewer">
      <button type="button" className="tkn-viewer-close" ref={closeButton} aria-label={t("ad.gallery.close")} onClick={onClose}>
        <X size={22} aria-hidden />
      </button>
      <span className="tkn-viewer-count" aria-hidden="true">{t("ad.gallery.counter", { index: index + 1, count })}</span>
      <div className="tkn-viewer-stage">
        {item.kind === "photo" ? (
          <img src={item.src} alt={`${title}, ${t("ad.gallery.photo", { index: index + 1, count })}`} />
        ) : (
          <video src={item.src} poster={item.poster ?? undefined} controls playsInline loop aria-label={title} />
        )}
      </div>
      {count > 1 ? (
        <>
          <button type="button" className="tkn-gal-nav is-prev" aria-label={t("ad.gallery.prev")} onClick={() => onIndex(wrapIndex(index - 1, count))}>
            <ChevronLeft size={22} aria-hidden />
          </button>
          <button type="button" className="tkn-gal-nav is-next" aria-label={t("ad.gallery.next")} onClick={() => onIndex(wrapIndex(index + 1, count))}>
            <ChevronRight size={22} aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  );
}
