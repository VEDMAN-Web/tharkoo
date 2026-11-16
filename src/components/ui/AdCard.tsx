"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Calendar, Camera, Check, MapPin, Phone } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace } from "@/lib/format";
import { listingPhotos } from "@/lib/media";
import { isCityAlias } from "@/lib/seo/district-alias";
import { PriceTag } from "../search/PriceTag";
import { formatPrice } from "../search/price";
import { PhotoSwipe } from "./PhotoSwipe";
import { SaveButton } from "./SaveButton";
import { viewsLabel } from "@/components/ad/counts-format";
import { api, friendlyError } from "@/lib/ui/api";
import { adPath } from "@/lib/urls";
import { useUrlPaths } from "../UrlPaths";
import { makeT, type TextFn, type UiTextMap } from "@/lib/ui/text";
import { videoVerifiedLabel } from "../ad/tourLabels";
import { recordAdClick, useShownCounts, watchAdCard } from "../ad/adCountStore";
import { AdCountsLabel } from "../ad/AdCountsLabel";
import { useSellerStatus } from "../availability/sellerStatus";
import { AvailabilityBadge } from "../availability/AvailabilityBadge";

const TextContext = createContext<UiTextMap | undefined>(undefined);

/** Hands the admin-edited UI text (see /admin/ui-text/) to the ad cards below it. Without one the built-in text is used. */
export function UiTextProvider({ texts, children }: { texts?: UiTextMap; children: ReactNode }) {
  return <TextContext.Provider value={texts}>{children}</TextContext.Provider>;
}

export function useT(): TextFn {
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

/**
 * H7.5: the seller's own view of a card in the vendor panel. The status chip, the ad's own shown views and clicks,
 * and the owner actions. In owner mode the card does not count the owner's own visits or clicks.
 */
export type AdOwnerView = { label: string; bg: string; fg: string; views: number; clicks: number; href?: string; actions?: ReactNode };

export function AdCard({
  ad,
  featured,
  priority,
  owner,
  layout,
  byline,
}: {
  ad: ListingDoc;
  featured?: boolean;
  priority?: boolean;
  /** "row": the H7.4b listing card (photo left, text right; photo on top below 600 px). Default: the card used everywhere else. */
  layout?: "row" | "tile";
  owner?: AdOwnerView;
  byline?: string;
}) {
  const t = useT();
  const variant = variantOf(ad, featured);
  const title = displayTitle(ad.title) || t("card.fallbackTitle");
  const publicHref = adPath(useUrlPaths(), ad.slug || "");
  const href = owner?.href ?? publicHref;
  const photos = listingPhotos(ad.categorySlug, ad.publicId || ad.slug || "", ad.photos || []);
  const superTop = variant === "supertop" || variant === "star";
  const [shown, setShown] = useState("");
  const [note, setNote] = useState("");
  const city = prettyPlace(ad.citySlug);
  const area = ad.place && !isCityAlias(city, ad.place) ? ad.place : "";
  const place = `${city}${area ? `/ ${area}` : ""}`.slice(0, 22);
  const tier = variant in TIER_KEYS ? t(TIER_KEYS[variant as keyof typeof TIER_KEYS]) : "";
  const videoVerified = videoVerifiedLabel(ad.videoVerifiedUntil);
  const cardRef = useRef<HTMLElement>(null);
  const counts = useShownCounts(ad.slug || "");
  const isOwner = Boolean(owner);
  // H7.5: the seller's Online now or Away, and whether calls are allowed. The owner view does not show it.
  const seller = useSellerStatus(isOwner ? undefined : ad.slug);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !ad.slug || isOwner) return;
    return watchAdCard(el, ad.slug);
  }, [ad.slug, isOwner]);

  /** A click on the card's own link to the ad counts as a click (H6.17). Other clicks on the card do not. */
  function onCardClick(event: React.MouseEvent<HTMLElement>) {
    if (isOwner) return;
    const link = (event.target as Element).closest?.("a[href]");
    if (ad.slug && link && link.getAttribute("href") === href) recordAdClick(ad.slug);
  }

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

  if (layout === "row") {
    const verifiedText = videoVerified || ad.trust?.[0] || "";
    const placeText = `${city}${area ? ` / ${area}` : ""}`;
    const priceText = formatPrice(ad.price);
    return (
      <article ref={cardRef} className="tk-card tkn-ls-card m-lift" data-tk="card" data-reveal data-variant={variant} onClickCapture={onCardClick}>
        <div className="tkn-ls-photo">
          <PhotoSwipe photos={photos} title={title} seed={ad.slug || title} category={ad.categorySlug} priority={priority} />
          {tier ? (
            <span className="tkn-ls-tier" data-tier={variant}>
              {tier}
            </span>
          ) : null}
          {photos.length > 1 ? (
            <span className="tkn-ls-count">
              <Camera size={12} aria-hidden />
              {photos.length}
            </span>
          ) : null}
          <span className="tkn-ls-wm" aria-hidden>
            tharkoo.com
          </span>
        </div>
        <a className="tkn-ls-stretch" href={href} aria-label={title} />
        <div className="tkn-ls-body">
          <div className="tkn-ls-titlerow">
            <h2 className="tkn-ls-title">{title}</h2>
            <SaveButton
              item={{ id: ad.publicId || ad.slug || title, slug: ad.slug || "", title, photo: photos[0] ?? null, place: placeText, at: 0 }}
              className="tkn-ls-save relative z-[2] h-[38px] w-[38px] min-h-[38px] min-w-[38px] shrink-0 justify-center border border-[#EAD8F0] bg-white px-0 text-[#C2185B]"
            />
          </div>
          {byline ? <p className="tkn-ls-by">{byline}</p> : null}
          {ad.description ? <p className="tkn-ls-desc">{ad.description}</p> : null}
          <div className="tkn-ls-pills">
            {verifiedText ? <span className="tkn-ls-pill-ok">{verifiedText}</span> : null}
            {ad.categorySlug ? <span className="tkn-ls-pill-cat">{prettyPlace(ad.categorySlug)}</span> : null}
            {placeText ? <span className="tkn-ls-pill-place">{placeText}</span> : null}
          </div>
          <div className="tkn-ls-foot">
            {priceText ? <span className="tkn-ls-price" data-tk="card-price">{priceText}</span> : <span />}
            <AdCountsLabel counts={counts ?? { views: 0, clicks: 0 }} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      ref={cardRef}
      className="tk-card"
      data-tk="card"
      data-reveal
      data-variant={variant}
      data-contact={superTop ? "1" : undefined}
      onClickCapture={onCardClick}
    >
      {seller && seller.chatOn ? (
        <span className="tkp-card-avail">
          <AvailabilityBadge status={seller.status} />
        </span>
      ) : null}
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
                  <span>{item}</span>
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
          {seller && !seller.people ? (
            <button type="button" className="tk-circle" aria-label={seller.callsAllowed === false ? `${t("card.contact.call")}: the seller is away` : t("card.contact.call")} data-tk="call" disabled={seller.callsAllowed === false} onClick={() => reveal("phone")}>
              <Phone size={16} color="#A8124F" />
            </button>
          ) : null}
          <button type="button" className="tk-circle" aria-label={t("card.contact.whatsapp")} data-tk="whatsapp" onClick={() => reveal("whatsapp")}>
            <WaIcon />
          </button>
        </div>
      ) : null}
      {shown ? <p className="t-caption" style={{ position: "absolute", left: 12, bottom: 8 }}>{shown}</p> : null}
      {note ? <p className="t-caption" style={{ position: "absolute", left: 12, bottom: 8 }}>{note}</p> : null}
      {owner ? (
        <div className="tkp-owner" data-tk="owner-card">
          <div className="tkp-owner-row">
            <span className="tkp-owner-status" style={{ background: owner.bg, color: owner.fg }}>{owner.label}</span>
            <span className="tkp-owner-counts">{owner.views} {viewsLabel(owner.views)} · {owner.clicks} clicks</span>
          </div>
          {owner.actions ? <div className="tkp-owner-actions">{owner.actions}</div> : null}
        </div>
      ) : (
        <AdCountsLabel counts={counts} />
      )}
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
