"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { recordAdClick, watchAdCard } from "@/components/ad/adCountStore";
import { useSellerStatus } from "@/components/availability/sellerStatus";
import { HomeAdPopout } from "./HomeAdPopout";
import "./home-ads.css";

export type HomeAdCardData = {
  slug: string;
  title: string;
  photos: string[];
  description: string;
  age: number | null;
  categoryName: string;
  categoryHref: string;
  city: string;
  cityHref: string;
  href: string;
};

export type HomeAdLabels = {
  online: string;
  watermark: string;
  photoPrev: string;
  photoNext: string;
  chat: string;
  viewAd: string;
  age: string;
};

const HOVER_DELAY_MS = 350;
const LEAVE_DELAY_MS = 140;
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

export function HomeAdCard({ ad, labels }: { ad: HomeAdCardData; labels: HomeAdLabels }) {
  const cardRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const over = useRef({ card: false, pop: false });
  const seller = useSellerStatus(ad.slug || undefined);
  const [index, setIndex] = useState(0);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const photos = ad.photos;
  const online = Boolean(seller && seller.chatOn && seller.status === "online");

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !ad.slug) return;
    return watchAdCard(el, ad.slug);
  }, [ad.slug]);

  const clearTimers = useCallback(() => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const open = useCallback(() => {
    if (!window.matchMedia(FINE_POINTER).matches) return;
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    if (showTimer.current !== null || anchor) return;
    showTimer.current = window.setTimeout(() => {
      showTimer.current = null;
      if (cardRef.current) setAnchor(cardRef.current.getBoundingClientRect());
    }, HOVER_DELAY_MS);
  }, [anchor]);

  const close = useCallback(() => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    showTimer.current = null;
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      if (!over.current.card && !over.current.pop) setAnchor(null);
    }, LEAVE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (!anchor) return;
    const hide = () => {
      over.current = { card: false, pop: false };
      setAnchor(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor]);

  function onScroll() {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  }

  function step(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" });
  }

  function pointerEnter(event: ReactPointerEvent) {
    if (event.pointerType !== "mouse") return;
    over.current.card = true;
    open();
  }

  function pointerLeave(event: ReactPointerEvent) {
    if (event.pointerType !== "mouse") return;
    over.current.card = false;
    close();
  }

  const clicked = () => {
    if (ad.slug) recordAdClick(ad.slug);
  };

  return (
    <article
      ref={cardRef}
      className={anchor ? "tkh-ad is-lifted" : "tkh-ad"}
      data-tk="home-ad"
      onPointerEnter={pointerEnter}
      onPointerLeave={pointerLeave}
      onFocus={(event) => {
        if (event.target instanceof Element && event.target.matches(":focus-visible")) {
          over.current.card = true;
          open();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          over.current.card = false;
          close();
        }
      }}
    >
      <div className="tkh-ad-photo">
        <div className="tkh-ad-track" ref={trackRef} onScroll={onScroll}>
          {photos.length ? (
            photos.map((src, position) => (
              <Link key={src + position} href={ad.href} prefetch={false} className="tkh-ad-slide" tabIndex={-1} aria-hidden="true" onClick={clicked}>
                <img src={src} alt="" width={400} height={500} loading={position === 0 ? "eager" : "lazy"} draggable={false} />
              </Link>
            ))
          ) : (
            <Link href={ad.href} prefetch={false} className="tkh-ad-slide tkh-ad-empty" tabIndex={-1} aria-hidden="true" onClick={clicked} />
          )}
        </div>
        {photos.length > 1 ? <span className="tkh-ad-count" aria-hidden="true">{index + 1}/{photos.length}</span> : null}
        {ad.slug ? (
          <SaveButton item={{ id: ad.slug, slug: ad.slug, title: ad.title, place: ad.city, photo: photos[0] ?? null, at: 0 }} className="tkh-heart" />
        ) : null}
        {photos.length > 1 ? (
          <>
            <button type="button" className="tkh-photo-arrow is-prev" aria-label={labels.photoPrev} disabled={index === 0} onClick={() => step(-1)}>
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button type="button" className="tkh-photo-arrow is-next" aria-label={labels.photoNext} disabled={index >= photos.length - 1} onClick={() => step(1)}>
              <ChevronRight size={16} aria-hidden />
            </button>
            <div className="tkh-ad-dots" aria-hidden="true">
              {photos.map((src, position) => (
                <i key={src + position} className={position === index ? "is-on" : undefined} />
              ))}
            </div>
          </>
        ) : null}
        {online ? (
          <span className="tkh-ad-online" data-tk="availability" data-status="online">
            <span aria-hidden />
            {labels.online}
          </span>
        ) : null}
        <span className="tkh-ad-watermark" aria-hidden>{labels.watermark}</span>
      </div>
      <div className="tkh-ad-body">
        <h3 className="tkh-ad-title">
          <Link href={ad.href} prefetch={false} className="tkh-ad-link" onClick={clicked}>
            {ad.title}
          </Link>
        </h3>
        <p className="tkh-ad-pills">
          <Link href={ad.categoryHref} prefetch={false} className="tkh-pill tkh-pill-rose">{ad.categoryName}</Link>
          {ad.city ? (
            <Link href={ad.cityHref} prefetch={false} className="tkh-pill tkh-pill-lavender">{ad.city}</Link>
          ) : null}
        </p>
      </div>
      {anchor ? (
        <HomeAdPopout
          ad={ad}
          labels={labels}
          anchor={anchor}
          online={online}
          onEnter={() => {
            over.current.pop = true;
            if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
          }}
          onLeave={() => {
            over.current.pop = false;
            close();
          }}
        />
      ) : null}
    </article>
  );
}
