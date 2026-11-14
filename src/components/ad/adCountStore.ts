"use client";

import { useSyncExternalStore } from "react";

/**
 * H6.17 client side of the ad counts. A view is sent once per page for each ad (the server decides once per visitor).
 * Clicks are sent at once with sendBeacon, so they still go out when the card navigates away.
 * Shown counts come from /api/views/counts/ for the cards on screen, every 30 seconds while the tab is visible.
 */
export interface ShownCounts {
  views: number;
  clicks: number;
}

const EVENTS_PATH = "/api/views/";
const COUNTS_PATH = "/api/views/counts/";
const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const VIEW_DWELL_MS = 1000;
const FLUSH_DELAY_MS = 1500;
const REFRESH_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 60;
const MAX_BATCH = 50;
const MAX_SLUGS = 60;

type EventType = "view" | "click";
type Pending = { slug: string; type: EventType };
type Tracked = { slug: string; timer?: ReturnType<typeof setTimeout>; counted: boolean; onScreen: boolean };

const values = new Map<string, ShownCounts>();
const listeners = new Set<() => void>();
const onScreen = new Map<string, number>();
const sentViews = new Set<string>();
const tracked = new Map<Element, Tracked>();
let queue: Pending[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let observer: IntersectionObserver | null = null;
let started = false;
let lastRefresh = 0;

function isPreviewPage(): boolean {
  return window.location.search.includes("preview");
}

function notify() {
  for (const listener of listeners) listener();
}

function send(batch: Pending[]) {
  const body = JSON.stringify({ events: batch.map(({ slug, type }) => ({ slug, type })) });
  try {
    if (navigator.sendBeacon?.(EVENTS_PATH, new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* fall through to fetch */
  }
  fetch(EVENTS_PATH, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {});
}

function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  if (queue.length === 0) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  send(batch);
  if (queue.length > 0) flush();
}

function enqueue(item: Pending) {
  queue.push(item);
  if (item.type === "click" || queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  flushTimer ??= setTimeout(flush, FLUSH_DELAY_MS);
}

/** Counts a view of an ad once per page. Not on preview pages. */
export function recordAdView(slug: string) {
  if (!SLUG_PATTERN.test(slug) || isPreviewPage() || sentViews.has(slug)) return;
  sentViews.add(slug);
  ensureStarted();
  enqueue({ slug, type: "view" });
}

/** Counts a click on an ad link. Sent at once. */
export function recordAdClick(slug: string) {
  if (!SLUG_PATTERN.test(slug) || isPreviewPage()) return;
  ensureStarted();
  enqueue({ slug, type: "click" });
}

async function refresh() {
  if (document.visibilityState !== "visible") return;
  const slugs = [...onScreen].filter(([, count]) => count > 0).map(([slug]) => slug);
  if (slugs.length === 0) return;
  lastRefresh = Date.now();
  let changed = false;
  for (let index = 0; index < slugs.length; index += MAX_SLUGS) {
    const chunk = slugs.slice(index, index + MAX_SLUGS);
    try {
      const res = await fetch(`${COUNTS_PATH}?slugs=${encodeURIComponent(chunk.join(","))}`, { credentials: "same-origin" });
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: { items?: Record<string, ShownCounts> } };
      for (const [slug, counts] of Object.entries(json.data?.items ?? {})) {
        const before = values.get(slug);
        if (before?.views === counts.views && before?.clicks === counts.clicks) continue;
        values.set(slug, { views: counts.views, clicks: counts.clicks });
        changed = true;
      }
    } catch {
      /* keep the last shown numbers */
    }
  }
  if (changed) notify();
}

function requestRefresh() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    void refresh();
  }, REFRESH_DEBOUNCE_MS);
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.setInterval(() => {
    if (document.visibilityState === "visible") void refresh();
  }, REFRESH_MS);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush();
    } else if (Date.now() - lastRefresh > REFRESH_MS) {
      requestRefresh();
    }
  });
}

function changeOnScreen(slug: string, delta: number) {
  const next = Math.max(0, (onScreen.get(slug) ?? 0) + delta);
  if (next === 0) onScreen.delete(slug);
  else onScreen.set(slug, next);
  if (delta > 0) requestRefresh();
}

function onEntries(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    const state = tracked.get(entry.target);
    if (!state) continue;
    if (entry.isIntersecting && !state.onScreen) {
      state.onScreen = true;
      changeOnScreen(state.slug, 1);
    } else if (!entry.isIntersecting && state.onScreen) {
      state.onScreen = false;
      changeOnScreen(state.slug, -1);
    }
    const halfVisible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
    if (halfVisible && !state.timer && !state.counted) {
      state.timer = setTimeout(() => {
        state.timer = undefined;
        if (document.visibilityState !== "visible") return;
        state.counted = true;
        recordAdView(state.slug);
      }, VIEW_DWELL_MS);
    } else if (!halfVisible && state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
  }
}

/** Starts watching one ad card: a view after 1 second at half on screen, and its shown counts while on screen. */
export function watchAdCard(element: Element, slug: string): () => void {
  if (typeof IntersectionObserver === "undefined" || !SLUG_PATTERN.test(slug) || isPreviewPage()) return () => {};
  ensureStarted();
  observer ??= new IntersectionObserver(onEntries, { threshold: [0, 0.5] });
  tracked.set(element, { slug, counted: sentViews.has(slug), onScreen: false });
  observer.observe(element);
  return () => {
    const state = tracked.get(element);
    if (state?.timer) clearTimeout(state.timer);
    if (state?.onScreen) changeOnScreen(state.slug, -1);
    tracked.delete(element);
    observer?.unobserve(element);
  };
}

/** Keeps the shown counts of one ad loaded while the caller is mounted (used on the ad page). */
export function holdAdCounts(slug: string): () => void {
  if (!SLUG_PATTERN.test(slug)) return () => {};
  ensureStarted();
  changeOnScreen(slug, 1);
  return () => changeOnScreen(slug, -1);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The shown counts for one ad, or null until the first load. Re-renders only when the numbers change. */
export function useShownCounts(slug: string): ShownCounts | null {
  return useSyncExternalStore(
    subscribe,
    () => values.get(slug) ?? null,
    () => null,
  );
}
