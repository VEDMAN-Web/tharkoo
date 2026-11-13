"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  poster?: string | null;
  type?: string;
  label: string;
  className?: string;
};

/** True when autoplay would be unkind: reduced motion or the browser is saving data. */
function autoplayBlocked() {
  if (typeof window === "undefined") return true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A muted looping clip that plays only while it is on screen. The poster is the placeholder, so the page
 * never waits on the video; nothing is downloaded until the clip scrolls near the viewport.
 */
export function ReelVideo({ src, poster, type, label, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (autoplayBlocked() || typeof IntersectionObserver === "undefined") {
      video.controls = true;
      return;
    }
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (video.preload === "none") video.preload = "metadata";
          void video.play().catch(() => {
            video.controls = true;
          });
        } else video.pause();
      },
      { threshold: 0.5 },
    );
    watcher.observe(video);
    return () => watcher.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      data-tk="reel"
      aria-label={label}
      muted
      loop
      playsInline
      preload="none"
      poster={poster || undefined}
      style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000", borderRadius: 12 }}
    >
      <source src={src} type={type} />
    </video>
  );
}
