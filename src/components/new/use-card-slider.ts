"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { watchAdCard } from "@/components/ad/adCountStore";
import { CALM_MS, VIDEO_CAP_MS, VISIBLE_SHARE, nextSlide, slideDelay, type CardSlide } from "./card-slides";
import { releaseVideo, takeVideo } from "./card-video-slots";

const SCROLL_SETTLE_MS = 700;

type Connection = { saveData?: boolean };

export function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function dataSaver() {
  return Boolean((navigator as Navigator & { connection?: Connection }).connection?.saveData);
}

/**
 * The photo and video slider of an ad card, shared by the Home card and the listing row card (H14.1).
 * Photos move on by themselves while the card is at least half on screen, video plays muted in its slide,
 * nothing moves in a hidden tab or with reduced motion, and a manual swipe calms it for a while.
 * `anchored`: the hover pop-out is open; its video element (`popVideoRef`) plays instead of the card's own.
 */
export function useCardSlider({
  cardRef,
  slug,
  slides,
  order,
  anchored = false,
  popVideoRef,
}: {
  cardRef: RefObject<HTMLElement | null>;
  slug: string;
  slides: CardSlide[];
  order: number;
  anchored?: boolean;
  popVideoRef?: MutableRefObject<HTMLVideoElement | null>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const settleTimer = useRef<number | null>(null);
  const moving = useRef(false);
  const firstRun = useRef(true);
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [calmUntil, setCalmUntil] = useState(0);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !slug) return;
    return watchAdCard(el, slug);
  }, [cardRef, slug]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: VISIBLE_SHARE });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cardRef]);

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
        video = anchored ? (popVideoRef?.current ?? null) : videoRef.current;
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
  }, [index, inView, tabHidden, calmUntil, slides, order, anchored, popVideoRef]);

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

  useEffect(
    () => () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    },
    [],
  );

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || !track.clientWidth || moving.current) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    if (next !== index) {
      calm();
      setIndex(next);
    }
  }, [calm, index]);

  const step = useCallback(
    (direction: 1 | -1) => {
      calm();
      setIndex((current) => (current + direction + slides.length) % slides.length);
    },
    [calm, slides.length],
  );

  return { trackRef, videoRef, index, setIndex, calm, onScroll, step };
}
