"use client";

import { useState } from "react";
import { ArrowUp, Calendar, Check, MapPin, Phone } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace } from "@/lib/format";
import { listingPhotos } from "@/lib/media";
import { PhotoSwipe } from "./PhotoSwipe";
import { api, friendlyError } from "@/lib/ui/api";
import { adPath } from "@/lib/urls";
import { useUrlPaths } from "../UrlPaths";

const TIER_LABEL: Record<string, string> = { top: "Top", supertop: "SUPER Top", star: "Star", highlight: "Highlight", new: "New" };

function variantOf(ad: ListingDoc, featured?: boolean) {
  if (featured) return "star";
  const raw = ad.variant || "free";
  if (raw === "flash") return "supertop";
  if (raw === "top" || raw === "supertop" || raw === "highlight" || raw === "star" || raw === "new" || raw === "free") return raw;
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
  const href = adPath(useUrlPaths(), ad.slug || "");
  const photos = listingPhotos(ad.categorySlug, ad.publicId || ad.slug || "", ad.photos || []);
  const superTop = variant === "supertop" || variant === "star";
  const [shown, setShown] = useState("");
  const [note, setNote] = useState("");
  const city = prettyPlace(ad.citySlug);
  const area = ad.place && ad.place !== city ? ad.place : "";
  const place = `${city}${area ? `/ ${area}` : ""}`.slice(0, 22);
  const tier = TIER_LABEL[variant];

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
    <article className="tk-card" data-tk="card" data-variant={variant} data-contact={superTop ? "1" : undefined}>
      <div className="tk-card-photo">
        <PhotoSwipe
          photos={photos}
          title={title}
          seed={ad.slug || title}
          category={ad.categorySlug}
          priority={priority}
          overlay={<a className="tk-card-hit" href={href} aria-label={title} tabIndex={-1} />}
        />
        {photos.length > 1 ? <span className="tk-photo-count">📷 {photos.length}</span> : null}
      </div>
      {tier ? (
        <span className="tk-tier-tab" data-tier={variant}>
          <ArrowUp size={11} aria-hidden />
          {tier}
        </span>
      ) : null}
      <a className="tk-card-link" href={href}>
        <span className="tk-card-body">
          <span className="tk-card-title">{title}</span>
          {ad.description ? <span className="tk-card-desc">{ad.description}</span> : null}
          {ad.trust?.length ? (
            <span className="tk-trust">
              {ad.trust.slice(0, 3).map((item) => (
                <span key={item} className="tk-chk" title={item}>
                  <Check size={12} aria-hidden />
                  <span aria-hidden>{item.replace(/\s*verified$/i, "")}</span>
                  <span className="sr-only">{item}</span>
                </span>
              ))}
            </span>
          ) : null}
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
      {superTop ? (
        <div className="tk-circles">
          <button type="button" className="tk-circle" aria-label="Call" data-tk="call" onClick={() => reveal("phone")}>
            <Phone size={16} color="#8A6416" />
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
