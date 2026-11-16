"use client";

import { useEffect, useRef } from "react";

export function PictureHeight() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const grid = marker.current?.parentElement;
    const card = grid?.querySelector<HTMLElement>(".tkn-contact-panel");
    const safe = grid?.querySelector<HTMLElement>(".tkn-safe");
    if (!grid || !card || !safe) return;
    const apply = () => {
      const height = safe.getBoundingClientRect().bottom - card.getBoundingClientRect().top;
      if (height > 0) grid.style.setProperty("--tkn-pic-h", `${Math.round(height)}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(card);
    observer.observe(safe);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  return <span ref={marker} hidden />;
}
