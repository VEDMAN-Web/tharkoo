"use client";

import { useState } from "react";
import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace, timeAgo } from "@/lib/format";
import { listingTagSections } from "@/lib/media";
import { CitySync } from "./CityContext";
import { ContactButtons } from "./ContactButtons";
import { Gallery } from "./ui/Gallery";
import { Badge } from "./ui/Badge";
import { SaveButton } from "./ui/SaveButton";
import { AdCard } from "./ui/AdCard";
import { TrackView } from "./ui/RecentlyViewed";
import { Container } from "./ui/Container";

export function AdDetail({
  ad,
  categoryName,
  related = [],
  listingId,
}: {
  ad: ListingDoc;
  categoryName: string;
  related?: ListingDoc[];
  listingId?: string;
}) {
  const title = displayTitle(ad.title) || "Listing";
  const city = prettyPlace(ad.citySlug);
  const sections = listingTagSections(ad.tags);
  const [copied, setCopied] = useState("");

  async function share() {
    const url = `${window.location.origin}/ad/${ad.slug}/`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied("Link copied");
    } catch {
      setCopied("Copy the link from the address bar.");
    }
  }

  return (
    <div className="pb-24 lg:pb-10">
      <TrackView ad={ad} />
      <CitySync name={city} slug={ad.citySlug} />
      <Container className="py-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <Gallery photos={ad.photos || []} title={title} seed={ad.slug || title} category={ad.categorySlug} />
            <h1 className="t-h1 mt-6">{title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{categoryName}</Badge>
              {city ? <Badge>{city}</Badge> : null}
              <Badge>{timeAgo(ad.publishedAt || ad.createdAt) || "Posted"}</Badge>
              {ad.verified ? <Badge tone="verified">Verified</Badge> : null}
            </div>
            <section className="mt-8 max-w-[68ch]">
              <h2 className="t-h2">About</h2>
              <p className="t-body mt-3 whitespace-pre-wrap">{ad.description}</p>
            </section>
            {sections.map((section) => (
              <section key={section.title || "traits"} className="mt-8">
                <h2 className="t-h2">{section.title || "Details"}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {section.items.map((item) => (
                    <span key={item} className="rounded-pill border border-line px-3 py-1 t-small">
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            ))}
            <section className="mt-8 rounded-lg border border-line bg-surface p-4">
              <h2 className="t-h3">Safety tips</h2>
              <ul className="mt-2 grid gap-2 t-small text-muted">
                <li>Meet in a public place and keep payments on a method you can trace.</li>
                <li>Tharkoo staff will not ask you to pay them to view an ad.</li>
                <li>Report a listing that asks for money up front or looks misleading.</li>
              </ul>
            </section>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link href={`/submit-report/?ad=${ad.publicId || ad.slug || ""}`} className="t-small text-gold">
                Report this ad
              </Link>
              <button type="button" className="t-small text-gold" onClick={share}>
                Share
              </button>
              {copied ? <span className="t-caption text-muted">{copied}</span> : null}
            </div>
          </div>
          <aside className="hidden h-fit rounded-xl border border-line bg-surface p-4 lg:sticky lg:top-24 lg:block" id="contact">
            <h2 className="t-h3">Contact</h2>
            <p className="t-small mt-2 text-muted">Details stay hidden until you ask for them.</p>
            <div className="mt-4">
              <ContactButtons listingSlug={ad.slug} listingId={listingId} />
            </div>
            <div className="mt-3">
              <SaveButton
                item={{ id: ad.publicId || ad.slug || title, slug: ad.slug || "", title, photo: ad.photos?.[0], place: city, at: 0 }}
                label="Save listing"
                className="bg-surface-2"
              />
            </div>
          </aside>
        </div>
        {related.length ? (
          <section className="mt-12">
            <h2 className="t-h2">Related ads</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.slice(0, 6).map((item) => (
                <AdCard key={item.slug} ad={item} layout="tile" />
              ))}
            </div>
          </section>
        ) : null}
      </Container>
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 gap-2 border-t border-line bg-bg/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <ContactButtons listingSlug={ad.slug} listingId={listingId} sticky />
        <SaveButton
          item={{ id: ad.publicId || ad.slug || title, slug: ad.slug || "", title, photo: ad.photos?.[0], place: city, at: 0 }}
          label="Save"
          className="w-full bg-surface-2"
        />
      </div>
    </div>
  );
}
