"use client";

import { useEffect, useState } from "react";
import type { ListingDoc } from "@/lib/models";
import { adHref } from "@/lib/urls";
import { useUrlPaths } from "@/components/UrlPaths";
import { prettyPlace } from "@/lib/format";

const KEY = "tk-recent";

type Recent = ListingDoc & { at?: number };

export function track(item: ListingDoc) {
  if (typeof window === "undefined" || !item.slug) return;
  const current = readRecent();
  const next = [item, ...current.filter((row) => row.slug !== item.slug)].slice(0, 12);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("tk-recent"));
}

export function readRecent(): Recent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** H19.5: the compact card: photo, the title on one line and the city. Never the description. */
export function RecentCard({ ad }: { ad: Recent }) {
  const paths = useUrlPaths();
  const photo = ad.photos?.[0];
  return (
    <a className="tk-recent" href={adHref(paths, ad)} data-tk="recent-card">
      {photo ? <img src={photo} alt="" width={148} height={112} loading="lazy" /> : <span className="tk-recent-ph" aria-hidden="true" />}
      <strong>{ad.title || "Ad"}</strong>
      <span>{prettyPlace(ad.citySlug) || ad.place || ""}</span>
    </a>
  );
}

export function RecentlyViewedRail({ current }: { current?: string }) {
  const [items, setItems] = useState<Recent[]>([]);
  useEffect(() => {
    const sync = () => setItems(readRecent().filter((row) => row.slug !== current));
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
          <RecentCard key={ad.slug} ad={ad} />
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
