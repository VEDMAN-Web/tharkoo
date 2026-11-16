"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useT } from "@/components/ui/AdCard";
import type { GalleryItem } from "./gallery-items";

const VISIBLE_RATIO = 0.6;

type VideoItem = Extract<GalleryItem, { kind: "video" }>;

export function GalleryVideo({ item, active, label }: { item: VideoItem; active: boolean; label: string }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [wantsPlay, setWantsPlay] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => setOnScreen(entries.some((entry) => entry.intersectionRatio >= VISIBLE_RATIO)), {
      threshold: [0, VISIBLE_RATIO, 1],
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setTabHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const shouldPlay = active && onScreen && !tabHidden && (wantsPlay ?? !reduced);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (shouldPlay) void el.play().catch(() => undefined);
    else el.pause();
  }, [shouldPlay]);

  function toggle() {
    const el = video.current;
    if (!el) return;
    setWantsPlay(el.paused);
  }

  function toggleMute() {
    const el = video.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  return (
    <div className="tkn-gal-videobox" ref={box} data-tk="gallery-video" data-playing={playing ? "yes" : "no"}>
      {item.poster ? <img className="tkn-gal-blur" src={item.poster} alt="" aria-hidden="true" /> : null}
      <video
        ref={video}
        className="tkn-gal-video"
        muted
        loop
        playsInline
        preload="metadata"
        poster={item.poster ?? undefined}
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={item.src} type={item.type} />
      </video>
      <div className="tkn-gal-vtools">
        <button type="button" className="tkn-gal-vbtn" aria-label={playing ? t("ad.gallery.pause") : t("ad.gallery.play")} data-tk="gallery-play" onClick={toggle}>
          {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
        </button>
        <button type="button" className="tkn-gal-vbtn" aria-label={muted ? t("ad.gallery.unmute") : t("ad.gallery.mute")} data-tk="gallery-mute" onClick={toggleMute}>
          {muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
