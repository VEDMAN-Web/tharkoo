"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ArrowUp, Calendar, Check, MapPin, Phone } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace } from "@/lib/format";
import { listingPhotos } from "@/lib/media";
import { PriceTag } from "../search/PriceTag";
import { PhotoSwipe } from "./PhotoSwipe";
import { api, friendlyError } from "@/lib/ui/api";
import { adPath } from "@/lib/urls";
import { useUrlPaths } from "../UrlPaths";
import { makeT, type TextFn, type UiTextMap } from "@/lib/ui/text";
import { videoVerifiedLabel } from "../ad/tourLabels";

const TextContext = createContext<UiTextMap | undefined>(undefined);

/** Hands the admin-edited UI text (see /admin/ui-text/) to the ad cards below it. Without one the built-in text is used. */
export function UiTextProvider({ texts, children }: { texts?: UiTextMap; children: ReactNode }) {
  return <TextContext.Provider value={texts}>{children}</TextContext.Provider>;
}

function useT(): TextFn {
  const texts = useContext(TextContext);
  return useMemo(() => makeT(texts), [texts]);
}

const TIER_KEYS = { top: "card.tier.top", supertop: "card.tier.supertop", star: "card.tier.star", highlight: "card.tier.highlight", new: "card.tier.new" } as const;

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
  const t = useT();
  const variant = variantOf(ad, featured);
  const title = displayTitle(ad.title) || t("card.fallbackTitle");
  const href = adPath(useUrlPaths(), ad.slug || "");
  const photos = listingPhotos(ad.categorySlug, ad.publicId || ad.slug || "", ad.photos || []);
  const superTop = variant === "supertop" || variant === "star";
  const [shown, setShown] = useState("");
  const [note, setNote] = useState("");
  const city = prettyPlace(ad.citySlug);
  const area = ad.place && ad.place !== city ? ad.place : "";
  const place = `${city}${area ? `/ ${area}` : ""}`.slice(0, 22);
  const tier = variant in TIER_KEYS ? t(TIER_KEYS[variant as keyof typeof TIER_KEYS]) : "";
  const videoVerified = videoVerifiedLabel(ad.videoVerifiedUntil);

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
    setShown(res.data.value || t("card.contact.none"));
  }

  return (
    <article className="tk-card" data-tk="card" data-reveal data-variant={variant} data-contact={superTop ? "1" : undefined}>
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
          <PriceTag price={ad.price} />
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
          {videoVerified ? (
            <span className="tk-chip" data-tk="video-verified" style={{ alignSelf: "flex-start", background: "var(--ok-bg)", color: "var(--ok)" }}>
              <Check size={12} aria-hidden /> {videoVerified}
            </span>
          ) : null}
          <span className="tk-card-meta">
            <p>
              <Calendar size={12} aria-hidden />
              <strong>{ad.age ? t("card.age", { age: ad.age }) : prettyPlace(ad.categorySlug)}</strong>
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
          <button type="button" className="tk-circle" aria-label={t("card.contact.call")} data-tk="call" onClick={() => reveal("phone")}>
            <Phone size={16} color="#8A6416" />
          </button>
          <button type="button" className="tk-circle" aria-label={t("card.contact.whatsapp")} data-tk="whatsapp" onClick={() => reveal("whatsapp")}>
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
