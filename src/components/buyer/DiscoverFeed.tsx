"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdCard } from "../ui/AdCard";
import { displayTitle } from "@/lib/format";
import { api } from "@/lib/ui/api";
import type { ListingDoc } from "@/lib/models";
import type { DiscoverPage, FeedCard } from "@/server/discover/feed";

/** H7.6: "Discover ads" under the user panel and the chats screen. Same card as the listing pages. */

/** Infinite scroll loads this many extra pages, then the "Load more" button takes over. */
export const AUTO_LOAD_PAGES = 5;

export const PRICE_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: "Any price" },
  { label: "Under ₹5,000", max: 5000 },
  { label: "₹5,000 to ₹20,000", min: 5000, max: 20000 },
  { label: "Over ₹20,000", min: 20000 },
];

type Option = { slug: string; name: string };
type Filters = { category: string; city: string; band: number; withVideo: boolean };

/** Pure: the query string for one page. Empty filters are left out. */
export function discoverQuery(filters: Filters, seed: string, page: number): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  const band = PRICE_BANDS[filters.band] ?? PRICE_BANDS[0];
  if (band.min !== undefined) params.set("minPrice", String(band.min));
  if (band.max !== undefined) params.set("maxPrice", String(band.max));
  if (filters.withVideo) params.set("withVideo", "1");
  params.set("seed", seed);
  params.set("page", String(page));
  return params.toString();
}

/** Pure: a feed card as the shared AdCard expects it. */
export function toAdDoc(card: FeedCard): ListingDoc {
  return {
    slug: card.slug,
    title: displayTitle(card.title),
    description: card.description,
    place: card.place,
    photos: card.photos,
    publicId: card.publicId,
    variant: card.variant,
    verified: card.verified,
    categorySlug: card.categorySlug,
    citySlug: card.citySlug,
    videoVerifiedUntil: card.videoVerifiedUntil,
  } as unknown as ListingDoc;
}

function newSeed() {
  return Math.random().toString(36).slice(2, 10) || "seed";
}

const SKELETON_COUNT = 6;

export function DiscoverFeed({
  categories,
  cities,
  heading = "Discover ads",
  intro = "Live ads from all sellers, in a random order.",
}: {
  categories: Option[];
  cities: Option[];
  heading?: string;
  intro?: string;
}) {
  const [seed, setSeed] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ category: "", city: "", band: 0, withVideo: false });
  const [items, setItems] = useState<FeedCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [autoLoads, setAutoLoads] = useState(0);
  const [sentinelVisible, setSentinelVisible] = useState(false);
  const requestRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(async (current: Filters, token: string, nextPage: number, append: boolean) => {
    const id = ++requestRef.current;
    setLoading(true);
    setFailed(false);
    const res = await api<DiscoverPage>(`/api/discover?${discoverQuery(current, token, nextPage)}`);
    if (id !== requestRef.current) return;
    setLoading(false);
    if (!res.ok) {
      setFailed(true);
      return;
    }
    setItems((prev) => (append ? [...prev, ...res.data.items] : res.data.items));
    setPage(res.data.page);
    setHasMore(res.data.hasMore);
  }, []);

  // The seed is made after mount, so the server and the first paint agree. It is fixed for this visit.
  useEffect(() => {
    const id = window.setTimeout(() => setSeed(newSeed()), 0);
    return () => window.clearTimeout(id);
  }, []);

  // A new filter or a new visit starts again at page 1.
  useEffect(() => {
    if (!seed) return;
    const id = window.setTimeout(() => {
      setItems([]);
      setAutoLoads(0);
      void fetchPage(filters, seed, 1, false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [seed, filters, fetchPage]);

  // Watch the sentinel below the feed for infinite scroll.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => setSentinelVisible(entries.some((entry) => entry.isIntersecting)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const canAutoLoad = Boolean(seed) && hasMore && !loading && !failed && autoLoads < AUTO_LOAD_PAGES;
  useEffect(() => {
    if (!sentinelVisible || !canAutoLoad || !seed) return;
    const id = window.setTimeout(() => {
      setAutoLoads((count) => count + 1);
      void fetchPage(filters, seed, page + 1, true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [sentinelVisible, canAutoLoad, seed, filters, page, fetchPage]);

  function loadMore() {
    if (!seed || loading || !hasMore) return;
    void fetchPage(filters, seed, page + 1, true);
  }

  const setFilter = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));
  const showEmpty = !loading && !failed && seed !== null && items.length === 0;

  return (
    <section aria-labelledby="discover-heading" className={`up-panel up-glass`} data-tk="discover">
      <div className="up-panel-head">
        <div>
          <h2 id="discover-heading" className="up-h2">{heading}</h2>
          <p className="up-muted">{intro}</p>
        </div>
      </div>
      <div role="group" aria-label="Filter ads" className="up-filters">
        <label className="up-label">
          Category
          <select className="up-select" value={filters.category} onChange={(event) => setFilter({ category: event.target.value })}>
            <option value="">All categories</option>
            {categories.map((option) => (
              <option key={option.slug} value={option.slug}>{option.name}</option>
            ))}
          </select>
        </label>
        <label className="up-label">
          City
          <select className="up-select" value={filters.city} onChange={(event) => setFilter({ city: event.target.value })}>
            <option value="">All cities</option>
            {cities.map((option) => (
              <option key={option.slug} value={option.slug}>{option.name}</option>
            ))}
          </select>
        </label>
        {PRICE_BANDS.map((band, index) => (
          <button
            key={band.label}
            type="button"
            className={`up-filter-btn ${filters.band === index ? "up-filter-on" : ""}`}
            aria-pressed={filters.band === index}
            onClick={() => setFilter({ band: index })}
          >
            {band.label}
          </button>
        ))}
        <button
          type="button"
          className={`up-filter-btn ${filters.withVideo ? "up-filter-on" : ""}`}
          aria-pressed={filters.withVideo}
          onClick={() => setFilter({ withVideo: !filters.withVideo })}
        >
          With video
        </button>
      </div>
      <p aria-live="polite" className="up-muted" style={{ margin: "14px 0" }}>
        {loading && items.length === 0 ? "Loading ads" : items.length ? `${items.length} ads shown` : ""}
      </p>
      {failed ? (
        <p className="up-error" role="alert">
          The ads could not load. <button type="button" className="up-link" onClick={() => seed && void fetchPage(filters, seed, 1, false)}>Try again</button>
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul className="up-cards-fill" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((card) => (
            <li key={card.id}>
              <AdCard ad={toAdDoc(card)} />
            </li>
          ))}
        </ul>
      ) : null}
      {loading && items.length === 0 ? (
        <div className="up-cards-fill" aria-hidden="true">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <div key={index} className="up-skeleton" />
          ))}
        </div>
      ) : null}
      {showEmpty ? (
        <div className={`up-empty up-glass`} style={{ marginTop: 8 }}>
          <p className="up-empty-title">No ads match these filters</p>
          <p className="up-empty-body">Try another category, city or price range.</p>
          <button type="button" className="up-btn-ghost" onClick={() => setFilters({ category: "", city: "", band: 0, withVideo: false })}>
            Clear filters
          </button>
        </div>
      ) : null}
      {loading && items.length > 0 ? (
        <div className="up-cards-fill" aria-hidden="true" style={{ marginTop: 16 }}>
          <div className="up-skeleton" />
          <div className="up-skeleton" />
        </div>
      ) : null}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {hasMore ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <button type="button" className="up-btn-ghost" onClick={loadMore} disabled={loading}>
            Load more ads
          </button>
        </div>
      ) : null}
    </section>
  );
}
