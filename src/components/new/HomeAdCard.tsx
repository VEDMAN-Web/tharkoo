"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { SaveButton } from "@/components/ui/SaveButton";
import { recordAdClick } from "@/components/ad/adCountStore";
import { useSellerStatus } from "@/components/availability/sellerStatus";
import { HomeAdPopout } from "./HomeAdPopout";
import { cardSlides } from "./card-slides";
import { SlideNav, SlideTrack } from "./CardSlides";
import { useCardSlider } from "./use-card-slider";
import "./home-ads.css";

export type HomeAdCardData = {
  slug: string;
  title: string;
  photos: string[];
  videoUrl?: string | null;
  videoPoster?: string | null;
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
  age: string;
};

const HOVER_DELAY_MS = 350;
const LEAVE_DELAY_MS = 140;
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

export function HomeAdCard({ ad, labels, order = 0 }: { ad: HomeAdCardData; labels: HomeAdLabels; order?: number }) {
  const popVideoRef = useRef<HTMLVideoElement | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const over = useRef({ card: false, pop: false });
  const seller = useSellerStatus(ad.slug || undefined);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const photos = ad.photos;
  const slides = useMemo(() => cardSlides(photos, ad.videoUrl, ad.videoPoster), [photos, ad.videoUrl, ad.videoPoster]);
  const online = Boolean(seller && seller.chatOn && seller.status === "online");
  const { cardRef, trackRef, videoRef, index, setIndex, calm, onScroll, step } = useCardSlider({ slug: ad.slug, slides, order, anchored: Boolean(anchor), popVideoRef });

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
      className={anchor ? "tkh-ad is-lifted m-lift" : "tkh-ad m-lift"}
      data-tk="home-ad"
      data-slide={index}
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
        <SlideTrack slides={slides} href={ad.href} trackRef={trackRef} videoRef={videoRef} onScroll={onScroll} onTouch={calm} onClicked={clicked} />
        {slides.length > 1 ? <span className="tkh-ad-count" aria-hidden="true">{index + 1}/{slides.length}</span> : null}
        {ad.slug ? (
          <SaveButton item={{ id: ad.slug, slug: ad.slug, title: ad.title, place: ad.city, photo: photos[0] ?? null, at: 0 }} className="tkh-heart" />
        ) : null}
        <SlideNav slides={slides} index={index} photoPrev={labels.photoPrev} photoNext={labels.photoNext} onStep={step} />
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
          chatOn={Boolean(seller?.chatOn)}
          slides={slides}
          index={index}
          onIndex={(position) => {
            calm();
            setIndex(position);
          }}
          videoRef={popVideoRef}
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
