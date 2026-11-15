"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR = "[data-reveal]";
const COUNT_SELECTOR = "[data-count-up]";
const STAGGER_MS = 40;
const MAX_STAGGERED = 8;
const COUNT_MS = 600;
const REVEAL_THRESHOLD = 0.15;

function countUp(el: HTMLElement) {
  const node = el.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  const raw = (node.nodeValue ?? "").trim();
  if (!/^\d[\d,]*$/.test(raw)) return;
  const target = Number(raw.replace(/,/g, ""));
  const start = performance.now();
  const frame = (now: number) => {
    const progress = Math.min((now - start) / COUNT_MS, 1);
    node.nodeValue = Math.round(target * (1 - (1 - progress) ** 3)).toLocaleString("en-IN");
    if (progress < 1) window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
}

export function MotionInit() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("tk-motion");

    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.classList.add("is-in");
          if (el.hasAttribute("data-count-up")) countUp(el);
          el.addEventListener("transitionend", () => el.classList.remove("tk-rv"), { once: true });
          observer.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: REVEAL_THRESHOLD },
    );

    const scan = () => {
      const fresh = [...document.querySelectorAll<HTMLElement>(`${REVEAL_SELECTOR}, ${COUNT_SELECTOR}`)].filter((el) => !seen.has(el));
      const below = fresh.filter((el) => el.hasAttribute("data-reveal") && el.getBoundingClientRect().top >= window.innerHeight);
      for (const el of fresh) seen.add(el);
      below.forEach((el, step) => {
        el.classList.add("tk-rv");
        el.style.setProperty("--tk-d", `${step < MAX_STAGGERED ? step * STAGGER_MS : 0}ms`);
        observer.observe(el);
      });
      for (const el of fresh) {
        if (el.hasAttribute("data-count-up")) observer.observe(el);
      }
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
