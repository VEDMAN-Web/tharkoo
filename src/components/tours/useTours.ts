"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, hasSessionHint } from "@/lib/ui/api";

/** One row from GET /api/tours: a video call this person asked for (buyer) or was asked for (advertiser). */
export type TourItem = {
  id: string;
  listingId: string;
  coins: number;
  status: string;
  role: "advertiser" | "buyer";
  requestedAt: string | null;
  acceptedAt: string | null;
  endedAt: string | null;
  failureReason: string | null;
  /** The ad this call is about (the same fields the Video calls page reads). */
  adTitle?: string | null;
  adSlug?: string | null;
  adPhoto?: string | null;
  /** The other person's name. */
  otherName?: string;
  /** Buyer rows still waiting: how many requests for the same advertiser came in first. */
  ahead: number | null;
  /** The advertiser is on another call right now. */
  busy: boolean;
  joinUrl?: string | null;
};

export const isOpenTour = (row: Pick<TourItem, "status">) => row.status === "requested" || row.status === "accepted";

/** Where a person goes to join an accepted call. */
export const callPage = (id: string) => `/u/account/tours/${encodeURIComponent(id)}/`;

/**
 * Reads the person's video calls and keeps them fresh: every 5 seconds while a call is waiting or accepted, every 20 seconds
 * otherwise, and straight away when the tab comes back. Nothing runs for a guest, a hidden tab, or `enabled: false`.
 */
export function useTours({ enabled = true, fastMs = 5000, slowMs = 20_000 }: { enabled?: boolean; fastMs?: number; slowMs?: number } = {}) {
  const [rows, setRows] = useState<TourItem[] | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    // A dropped connection (server restarting, tunnel blinking, offline) is not an error to show: the next check tries again.
    try {
      const res = await api<TourItem[]>("/api/tours");
      if (!alive.current || !res.ok) return null;
      setRows(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !hasSessionHint()) return;
    alive.current = true;
    let stopped = false;
    let running = false;
    let timer = 0;
    const tick = async () => {
      if (running) return;
      running = true;
      let next = slowMs;
      try {
        if (document.visibilityState !== "hidden") {
          const data = await reload();
          if (data?.some(isOpenTour)) next = fastMs;
        }
      } finally {
        running = false;
      }
      if (!stopped) timer = window.setTimeout(() => void tick(), next);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      void tick();
    };
    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      alive.current = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, fastMs, slowMs, reload]);

  return { rows, reload };
}
