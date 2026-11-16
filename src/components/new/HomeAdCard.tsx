"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { recordAdClick, watchAdCard } from "@/components/ad/adCountStore";
import { useSellerStatus } from "@/components/availability/sellerStatus";
import { HomeAdPopout } from "./HomeAdPopout";
import { CALM_MS, VIDEO_CAP_MS, VISIBLE_SHARE, cardSlides, nextSlide, slideDelay } from "./card-slides";
import { releaseVideo, takeVideo } from "./card-video-slots";
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
  viewAd: string;
  age: string;
};

const HOVER_DELAY_MS = 350;
const LEAVE_DELAY_MS = 140;
const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const SCROLL_SETTLE_MS = 700;

type Connection = { saveData?: boolean };

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function dataSaver() {
  return Boolean((navigator as Navigator & { connection?: Connection }).connection?.saveData);
}

export function HomeAdCard({ ad, labels, order = 0 }: { ad: HomeAdCardData; labels: HomeAdLabels; order?: number }) {
  const cardRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const popVideoRef = useRef<HTMLVideoElement | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const settleTimer = useRef<number | null>(null);
  const moving = useRef(false);
  const firstRun = useRef(true);
  const over = useRef({ card: false, pop: false });
  const seller = useSellerStatus(ad.slug || undefined);
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [calmUntil, setCalmUntil] = useState(0);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const photos = ad.photos;
  const slides = useMemo(() => cardSlides(photos, ad.videoUrl, ad.videoPoster), [photos, ad.videoUrl, ad.videoPoster]);
  const online = Boolean(seller && seller.chatOn && seller.status === "online");

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !ad.slug) return;
    return watchAdCard(el, ad.slug);
  }, [ad.slug]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: VISIBLE_SHARE });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const calm = useCallback(() => setCalmUntil(Date.now() + CALM_MS), []);

  useEffect(() => {
    if (slides.length < 2 || !inView || tabHidden || reducedMotion()) return;
    const withVideo = !dataSaver();
    const slide = slides[index];
    const first = firstRun.current;
    firstRun.current = false;
    const delay = slideDelay({ kind: slide?.kind === "video" && withVideo ? "video" : "image", first, order, now: Date.now(), calmUntil });
    const advance = () => setIndex((current) => nextSlide(current, slides, withVideo));
    if (slide?.kind === "video") {
      if (!withVideo) {
        const skip = window.setTimeout(advance, 0);
        return () => window.clearTimeout(skip);
      }
      let cap: number | undefined;
      let video: HTMLVideoElement | null = null;
      const start = window.setTimeout(() => {
        video = anchor ? popVideoRef.current : videoRef.current;
        if (!video || !takeVideo(video)) {
          advance();
          return;
        }
        video.currentTime = 0;
        video.onended = advance;
        cap = window.setTimeout(advance, VIDEO_CAP_MS);
      }, delay);
      return () => {
        window.clearTimeout(start);
        if (cap !== undefined) window.clearTimeout(cap);
        if (video) video.onended = null;
        releaseVideo(video);
      };
    }
    const timer = window.setTimeout(advance, delay);
    return () => window.clearTimeout(timer);
  }, [index, inView, tabHidden, calmUntil, slides, order, anchor]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const target = index * track.clientWidth;
    if (Math.abs(track.scrollLeft - target) < 2) return;
    moving.current = true;
    track.scrollTo({ left: target, behavior: index === 0 || reducedMotion() ? "auto" : "smooth" });
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      moving.current = false;
    }, SCROLL_SETTLE_MS);
  }, [index]);

  const clearTimers = useCallback(() => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
    settleTimer.current = null;
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
    if (!track || !track.clientWidth || moving.current) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    if (next !== index) {
      calm();
      setIndex(next);
    }
  }

  function step(direction: 1 | -1) {
    calm();
    setIndex((index + direction + slides.length) % slides.length);
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
        <div className="tkh-ad-track" ref={trackRef} onScroll={onScroll} onPointerDown={calm} onWheel={calm}>
          {slides.length ? (
            slides.map((slide, position) => (
              <Link key={slide.src + position} href={ad.href} prefetch={false} className={slide.kind === "video" ? "tkh-ad-slide tkh-ad-videoslide" : "tkh-ad-slide"} tabIndex={-1} aria-hidden="true" onClick={clicked}>
                {slide.kind === "video" ? (
                  <video ref={videoRef} src={slide.src} poster={slide.poster ?? undefined} muted playsInline preload="none" data-tk="card-video" />
                ) : (
                  <img src={slide.src} alt="" width={400} height={500} loading={position === 0 ? "eager" : "lazy"} draggable={false} />
                )}
              </Link>
            ))
          ) : (
            <Link href={ad.href} prefetch={false} className="tkh-ad-slide tkh-ad-empty" tabIndex={-1} aria-hidden="true" onClick={clicked} />
          )}
        </div>
        {slides.length > 1 ? <span className="tkh-ad-count" aria-hidden="true">{index + 1}/{slides.length}</span> : null}
        {ad.slug ? (
          <SaveButton item={{ id: ad.slug, slug: ad.slug, title: ad.title, place: ad.city, photo: photos[0] ?? null, at: 0 }} className="tkh-heart" />
        ) : null}
        {slides.length > 1 ? (
          <>
            <button type="button" className="tkh-photo-arrow is-prev" aria-label={labels.photoPrev} onClick={() => step(-1)}>
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button type="button" className="tkh-photo-arrow is-next" aria-label={labels.photoNext} onClick={() => step(1)}>
              <ChevronRight size={16} aria-hidden />
            </button>
            <div className="tkh-ad-dots" aria-hidden="true">
              {slides.map((slide, position) => (
                <i key={slide.src + position} className={position === index ? "is-on" : undefined} />
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
