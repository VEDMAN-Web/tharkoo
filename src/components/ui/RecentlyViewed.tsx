"use client";

import { useEffect, useState } from "react";
import type { ListingDoc } from "@/lib/models";
import { AdCard } from "./AdCard";

const KEY = "tk-recent";

type Recent = ListingDoc & { at?: number };

export function track(item: ListingDoc) {
  if (typeof window === "undefined" || !item.slug) return;
  const current = read();
  const next = [item, ...current.filter((row) => row.slug !== item.slug)].slice(0, 12);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("tk-recent"));
}

function read(): Recent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function RecentlyViewedRail({ current }: { current?: string }) {
  const [items, setItems] = useState<Recent[]>([]);
  useEffect(() => {
    const sync = () => setItems(read().filter((row) => row.slug !== current));
    sync();
    window.addEventListener("tk-recent", sync);
    return () => window.removeEventListener("tk-recent", sync);
  }, [current]);
  if (!items.length) return null;
  return (
    <section className="py-8" aria-label="Recently viewed">
      <h2 className="t-h2 mb-4">Recently viewed</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.slice(0, 12).map((ad) => (
          <div key={ad.slug} className="w-72 shrink-0">
            <AdCard ad={ad} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrackView({ ad }: { ad: ListingDoc }) {
  useEffect(() => {
    track(ad);
  }, [ad]);
  return null;
}
