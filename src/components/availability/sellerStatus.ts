"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/ui/api";

/**
 * H7.5: the seller status behind each ad on screen (Online now or Away, and whether calls are allowed).
 * Slugs asked for close together go out as one request, and every shown status is re-read once a minute.
 */
export interface SellerStatus {
  status: "online" | "away";
  callsAllowed: boolean;
  /** A people category: no video call and verify button. Call, WhatsApp and chat stay. */
  people: boolean;
}

const STATUS_PATH = "/api/availability/listings";
const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const BATCH_DELAY_MS = 40;
const REFRESH_MS = 60_000;
const MAX_SLUGS = 60;

const values = new Map<string, SellerStatus>();
const wanted = new Map<string, number>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let batchTimer: ReturnType<typeof setTimeout> | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

function notify() {
  for (const listener of listeners) listener();
}

async function load(slugs: string[]) {
  for (let index = 0; index < slugs.length; index += MAX_SLUGS) {
    const chunk = slugs.slice(index, index + MAX_SLUGS);
    const res = await api<{ items: Record<string, SellerStatus> }>(`${STATUS_PATH}?slugs=${encodeURIComponent(chunk.join(","))}`);
    if (!res.ok) continue;
    for (const [slug, status] of Object.entries(res.data.items ?? {})) values.set(slug, status);
    notify();
  }
}

function flushPending() {
  batchTimer = undefined;
  const slugs = [...pending];
  pending.clear();
  if (slugs.length) void load(slugs);
}

function askFor(slug: string) {
  pending.add(slug);
  batchTimer ??= setTimeout(flushPending, BATCH_DELAY_MS);
}

function refreshAll() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  const slugs = [...wanted.keys()];
  if (slugs.length) void load(slugs);
}

/** Registers interest in one ad's status. Returns the function that removes it when the card leaves the screen. */
function want(slug: string) {
  if (!SLUG_PATTERN.test(slug)) return () => {};
  wanted.set(slug, (wanted.get(slug) ?? 0) + 1);
  if (!values.has(slug)) askFor(slug);
  refreshTimer ??= setInterval(refreshAll, REFRESH_MS);
  return () => {
    const left = (wanted.get(slug) ?? 1) - 1;
    if (left > 0) wanted.set(slug, left);
    else wanted.delete(slug);
    if (wanted.size === 0 && refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The status of one ad's seller, or undefined until it is known (and for ads without a listing). */
export function useSellerStatus(slug: string | undefined): SellerStatus | undefined {
  useEffect(() => {
    if (!slug) return;
    return want(slug);
  }, [slug]);
  return useSyncExternalStore(subscribe, () => (slug ? values.get(slug) : undefined), () => undefined);
}
