"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR = "[data-reveal]";
const STAGGER_MS = 40;
const MAX_STAGGER_STEPS = 6;

// One small observer that fades in sections and cards as they enter the viewport.
// Anything already visible on first load is left alone (no animation above the fold).
export function MotionInit() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("tk-motion");

    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          el.classList.add("is-in");
          el.addEventListener("transitionend", () => el.classList.remove("tk-rv"), { once: true });
          observer.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );

    const scan = () => {
      // Read every position first, then write: avoids a forced layout per element.
      const fresh = [...document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)].filter((el) => !seen.has(el));
      const below = fresh.filter((el) => el.getBoundingClientRect().top >= window.innerHeight);
      for (const el of fresh) seen.add(el);
      below.forEach((el, step) => {
        el.classList.add("tk-rv");
        el.style.setProperty("--tk-d", `${(step % MAX_STAGGER_STEPS) * STAGGER_MS}ms`);
        observer.observe(el);
      });
      for (const img of document.querySelectorAll<HTMLImageElement>("img.tk-fade-img")) {
        if (img.complete && img.naturalWidth > 0) img.classList.add("is-loaded");
        else img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
      }
    };

    let queued = 0;
    const queueScan = () => {
      if (queued) return;
      queued = window.requestAnimationFrame(() => {
        queued = 0;
        scan();
      });
    };

    scan();
    const mutations = new MutationObserver(queueScan);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
      if (queued) window.cancelAnimationFrame(queued);
    };
  }, []);
  return null;
}
