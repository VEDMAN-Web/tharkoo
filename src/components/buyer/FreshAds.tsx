"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ListingCard, ListingGrid } from "../new/ListingCards";
import { displayTitle } from "@/lib/format";
import { api } from "@/lib/ui/api";
import type { ListingDoc } from "@/lib/models";
import type { DiscoverPage, FeedCard } from "@/server/discover/feed";

/** H7.17: six fresh ads on the user panel home and the chats screen. H14.1: as the approved listing row. */

const SHOWN = 6;

function toAdDoc(card: FeedCard): ListingDoc {
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

export function FreshAds({ title = "Fresh ads for you" }: { title?: string }) {
  const [items, setItems] = useState<FeedCard[] | null>(null);
  useEffect(() => {
    let live = true;
    api<DiscoverPage>("/api/discover?seed=fresh").then((res) => {
      if (live) setItems(res.ok ? res.data.items.slice(0, SHOWN) : []);
    });
    return () => {
      live = false;
    };
  }, []);
  // Nothing to show (still loading, a failed load, or no ads): no section at all, never an empty frame.
  if (!items || items.length === 0) return null;
  return (
    <section aria-labelledby="fresh-heading" className="up-glass up-panel" data-tk="discover">
      <div className="up-panel-head">
        <h2 id="fresh-heading" className="up-h2">{title}</h2>
        <Link href="/search/" className="up-link">See all ads</Link>
      </div>
      <ListingGrid label={title}>
        {items.map((card, position) => (
          <li key={card.slug}>
            <ListingCard ad={toAdDoc(card)} order={position} />
          </li>
        ))}
      </ListingGrid>
    </section>
  );
}
