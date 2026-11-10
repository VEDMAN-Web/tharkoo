"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Phone } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace } from "@/lib/format";
import { SmartImage } from "./SmartImage";
import { api, friendlyError } from "@/lib/ui/api";

function variantOf(ad: ListingDoc, featured?: boolean) {
  if (featured) return "star";
  const raw = ad.variant || "free";
  if (raw === "flash") return "supertop";
  if (raw === "top" || raw === "supertop" || raw === "highlight" || raw === "star" || raw === "free") return raw;
  return "free";
}

export function AdCard({
  ad,
  featured,
  priority,
}: {
  ad: ListingDoc;
  featured?: boolean;
  priority?: boolean;
  layout?: "row" | "tile";
}) {
  const variant = variantOf(ad, featured);
  const title = displayTitle(ad.title) || "Listing";
  const href = `/ad/${ad.slug}/`;
  const photos = (ad.photos || []).filter(Boolean);
  const withPhoto = variant === "top" || variant === "highlight" || variant === "supertop" || variant === "star";
  const superTop = variant === "supertop" || variant === "star";
  const [photo, setPhoto] = useState(0);
  const [shown, setShown] = useState("");
  const [note, setNote] = useState("");
  const city = prettyPlace(ad.citySlug);
  const area = ad.place && ad.place !== city ? ad.place : "";
  const place = `${city}${area ? `/ ${area}` : ""}`.slice(0, 22);
  const current = photos[photo] || photos[0];

  async function reveal(channel: "phone" | "whatsapp") {
    setNote("");
    if (!ad.slug) return;
    const pub = await api<{ id: string }>(`/api/listings/${encodeURIComponent(ad.slug)}/`);
    if (!pub.ok) return setNote(friendlyError(pub.error));
    const res = await api<{ value?: string | null }>(`/api/listings/${pub.data.id}/contact-reveal/`, {
      method: "POST",
      body: JSON.stringify({ channel }),
    });
    if (!res.ok) return setNote(friendlyError(res.error));
    setShown(res.data.value || "No number shared");
  }

  return (
    <article className="tk-card" data-tk="card" data-variant={variant}>
      {variant === "top" ? <span className="tk-badge-promo">Top</span> : null}
      {variant === "supertop" ? <span className="tk-badge-promo">SUPER Top</span> : null}
      {variant === "star" ? <span className="tk-badge-promo">Star</span> : null}
      <a className="tk-card-link" href={href}>
        {withPhoto ? (
          <span className="tk-card-photo">
            <SmartImage
              src={current}
              alt=""
              seed={ad.slug || title}
              category={ad.categorySlug}
              width={160}
              height={234}
              priority={priority}
              sizes="160px"
              className="h-full"
            />
            {photos.length ? <span className="tk-photo-count">📷 {photos.length}</span> : null}
          </span>
        ) : null}
        <span className="tk-card-body">
          <span className="tk-card-title">{title}</span>
          {ad.description ? <span className="tk-card-desc">{ad.description}</span> : null}
          <span className="tk-card-meta">
            <p>
              <Calendar size={12} aria-hidden />
              <strong>{ad.age ? `${ad.age} years` : prettyPlace(ad.categorySlug)}</strong>
            </p>
            <p>
              <MapPin size={12} aria-hidden />
              <span>
                <strong>{city}</strong>
                {area ? `/ ${area}` : ""}
                {place.length >= 22 ? "..." : ""}
              </span>
            </p>
          </span>
        </span>
      </a>
      {superTop && photos.length > 1 ? (
        <>
          <button type="button" className="tk-card-nav prev" aria-label="Previous photo" onClick={() => setPhoto((n) => (n - 1 + photos.length) % photos.length)}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="tk-card-nav next" aria-label="Next photo" onClick={() => setPhoto((n) => (n + 1) % photos.length)}>
            <ChevronRight size={16} />
          </button>
        </>
      ) : null}
      {superTop ? (
        <div className="tk-circles">
          <button type="button" className="tk-circle" aria-label="Call" data-tk="call" onClick={() => reveal("phone")}>
            <Phone size={16} color="#A63A5E" />
          </button>
          <button type="button" className="tk-circle" aria-label="WhatsApp" data-tk="whatsapp" onClick={() => reveal("whatsapp")}>
            <WaIcon />
          </button>
        </div>
      ) : null}
      {shown ? <p className="t-caption" style={{ position: "absolute", left: 12, bottom: 8 }}>{shown}</p> : null}
      {note ? <p className="t-caption" style={{ position: "absolute", left: 12, bottom: 8 }}>{note}</p> : null}
    </article>
  );
}

function WaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#0F8247" d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3zm0 2a7 7 0 0 1 0 14 7 7 0 0 1-3.6-1l-.3-.2-2.7.7.7-2.6-.2-.3A7 7 0 0 1 12 5z" />
    </svg>
  );
}

export function StarStrip({ ads }: { ads: ListingDoc[] }) {
  if (!ads.length) return null;
  return (
    <>
      {ads.map((ad) => (
        <AdCard key={ad.slug || ad.publicId} ad={ad} featured />
      ))}
    </>
  );
}
