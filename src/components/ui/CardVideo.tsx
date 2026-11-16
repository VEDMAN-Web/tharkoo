"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Play } from "lucide-react";

const VISIBLE_SHARE = 0.6;

let playing: HTMLVideoElement | null = null;

function begin(video: HTMLVideoElement) {
  if (playing && playing !== video) playing.pause();
  playing = video;
  void video.play().catch(() => undefined);
}

function end(video: HTMLVideoElement) {
  video.pause();
  if (playing === video) playing = null;
}

/**
 * The video of a list card. A small play badge marks the card. On a mouse the muted video plays while the pointer is on
 * the card; on a touch screen it plays muted while the card is at least 60% on screen, one card at a time. With reduced
 * motion a touch screen never autoplays.
 */
export function CardVideo({ url, poster, card }: { url: string; poster?: string; card: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const host = card.current;
    const video = ref.current;
    if (!host || !video) return;
    const show = () => setLive(true);
    const hide = () => setLive(false);
    video.addEventListener("playing", show);
    video.addEventListener("pause", hide);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stopWatching: () => void = () => undefined;
    if (coarse) {
      if (!reduced) {
        const observer = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? begin(video) : end(video)), { threshold: VISIBLE_SHARE });
        observer.observe(host);
        stopWatching = () => observer.disconnect();
      }
    } else {
      const enter = () => begin(video);
      const leave = () => end(video);
      host.addEventListener("mouseenter", enter);
      host.addEventListener("mouseleave", leave);
      stopWatching = () => {
        host.removeEventListener("mouseenter", enter);
        host.removeEventListener("mouseleave", leave);
      };
    }
    return () => {
      stopWatching();
      video.removeEventListener("playing", show);
      video.removeEventListener("pause", hide);
      end(video);
    };
  }, [card]);

  return (
    <>
      <video ref={ref} className="tkn-ls-video" data-tk="card-video" data-live={live ? "true" : "false"} src={url} poster={poster} muted loop playsInline preload="none" aria-hidden="true" />
      <span className="tkn-ls-playbadge" data-tk="video-badge" aria-hidden="true">
        <Play size={14} fill="currentColor" />
      </span>
    </>
  );
}
