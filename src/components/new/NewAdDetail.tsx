import Link from "next/link";
import { Flag, Shield } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace, shortDateLabel } from "@/lib/format";
import { listingPhotos, listingTagSections } from "@/lib/media";
import { ContactButtons, ContactProvider, type ContactPopupInfo } from "@/components/ContactButtons";
import { SaveButton } from "@/components/ui/SaveButton";
import { AdCard, UiTextProvider } from "@/components/ui/AdCard";
import { TrackView } from "@/components/ui/RecentlyViewed";
import { videoVerifiedLabel } from "@/components/ad/tourLabels";
import { BackLink } from "@/app/ad/[slug]/AdClientBits";
import { adPath, type UrlPaths } from "@/lib/urls";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import { formatPrice } from "@/components/search/price";
import { CitySync } from "@/components/CityContext";
import { AdMetaLine, AdSellerRow } from "./AdLiveBits";
import { NewGallery } from "./NewGallery";
import type { AdPopupAlt } from "./AdPopup";
import "./new-design.css";
import "./listing-spec.css";
import "./ad-spec.css";

const PERSONAL = new Set(["dating", "friendship", "meetups", "personal-ads"]);
const GOLD_TIERS = new Set(["supertop", "top", "verified"]);

function tierOf(ad: ListingDoc, categoryName: string) {
  if (ad.variant === "supertop" || ad.variant === "star") return { key: "supertop", label: "SUPER Top" };
  if (ad.variant === "top") return { key: "top", label: "Top" };
  if (ad.verified) return { key: "verified", label: "Verified" };
  return { key: "category", label: categoryName };
}

function placeOf(ad: ListingDoc) {
  const city = prettyPlace(ad.citySlug);
  const district = ad.place && ad.place !== city ? ad.place : prettyPlace(ad.districtSlug);
  return { city, district };
}

/**
 * H7.9: the similar ads as pop-up alternatives (the online ones are picked on screen). Live ads only; never this ad.
 */
export function popupAlternatives(ad: ListingDoc, related: ListingDoc[], paths: UrlPaths): AdPopupAlt[] {
  return related
    .filter((item) => Boolean(item.slug) && item.slug !== ad.slug)
    .slice(0, 3)
    .map((item) => {
      const { city, district } = placeOf(item);
      return {
        slug: item.slug || "",
        href: adPath(paths, item.slug || ""),
        title: displayTitle(item.title) || "Listing",
        place: district ? `${city} / ${district}` : city,
        price: formatPrice(item.price),
        photo: listingPhotos(item.categorySlug, item.publicId || item.slug || "", item.photos || [])[0] ?? null,
      };
    });
}

/**
 * H7.9: the ad page to the design contract (SPEC section 4): gallery and details on the left, a sticky glass contact
 * panel on the right, similar ads with the listing card, and on phones a fixed bottom bar. The video call and verify
 * pop-up opens from the video button, which the server offers only when a tour is allowed (people categories never get one).
 */
export function NewAdDetail({
  ad,
  categoryName,
  related = [],
  listingId,
  crumbs = [],
  shareUrl,
  heading,
  tour,
  peopleAd = false,
  paymentsLive = false,
  alternatives = [],
  sellerName = "",
  texts,
}: {
  ad: ListingDoc;
  categoryName: string;
  related?: ListingDoc[];
  listingId?: string;
  crumbs?: { name: string; path: string }[];
  shareUrl: string;
  heading?: string;
  tour?: { listingId: string; coins: number } | null;
  /** H7.5: people category (server check). No video call button. */
  peopleAd?: boolean;
  /** H7.9: true only when a real coin provider is set. Until then the pop-up says purchases open soon. */
  paymentsLive?: boolean;
  alternatives?: AdPopupAlt[];
  /** H7.9 (F9): the seller's display name. Empty shows "Seller". Never the ad title. */
  sellerName?: string;
  /** Admin-edited UI text (ad.* and card.* keys). Without it the built-in text is used. */
  texts?: UiTextMap;
}) {
  const t = makeT(texts);
  const title = heading || displayTitle(ad.title) || "Listing";
  const videoVerified = videoVerifiedLabel(ad.videoVerifiedUntil);
  const { city, district } = placeOf(ad);
  const placeText = district ? `${city} / ${district}` : city;
  const sections = listingTagSections(ad.tags);
  const personal = PERSONAL.has(ad.categorySlug || "");
  const date = shortDateLabel(ad.publishedAt || ad.createdAt);
  const listHref = `/${ad.categorySlug}/${ad.citySlug}/`;
  const tier = tierOf(ad, categoryName);
  const photos = listingPhotos(ad.categorySlug, ad.publicId || ad.slug || "", ad.photos || []);
  const seller = sellerName?.trim() || t("ad.seller.name");
  const price = formatPrice(ad.price);
  const similar = related.filter((item) => item.slug !== ad.slug).slice(0, 4);
  const popupInfo: ContactPopupInfo = { sellerName: seller, paymentsLive, alternatives };

  return (
    <UiTextProvider texts={texts}>
      <ContactProvider listingSlug={ad.slug} listingId={listingId} tour={tour} peopleAd={peopleAd} info={popupInfo}>
        <div className="tkn-page tkn-ad" data-tk="new-ad">
          <TrackView ad={ad} />
          <CitySync name={city} slug={ad.citySlug} />
          <p className="tkn-ad-back">
            <BackLink href={listHref}>&lt; Back to search</BackLink>
          </p>
          <nav className="tkn-ad-crumbs" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => (
              <span key={crumb.path}>
                {index > 0 ? <span aria-hidden="true"> / </span> : null}
                <Link href={crumb.path} prefetch={false}>{crumb.name}</Link>
              </span>
            ))}
          </nav>
          <div className="tkn-ad-grid">
            <div className="tkn-ad-main">
              <NewGallery photos={photos} title={title} badge={GOLD_TIERS.has(tier.key) ? tier.label : null} />
              <section className="tkn-ad-head" data-tk="ad-summary">
                <div className="tkn-ad-titlerow">
                  <h1>{title}</h1>
                  <SaveButton item={{ id: ad.slug || title, slug: ad.slug || "", title, place: city, at: 0 }} className="bg-transparent text-accent" />
                </div>
                <AdMetaLine slug={ad.slug || ""} place={placeText} posted={date} />
                {ad.age || ad.publicId ? (
                  <p className="tkn-ad-date">
                    {ad.age ? `${ad.age} years` : ""}
                    {ad.age && ad.publicId ? " · " : ""}
                    {ad.publicId ? `Ad ID: ${ad.publicId}` : ""}
                  </p>
                ) : null}
                {ad.trust?.length || videoVerified ? (
                  <ul className="tkn-ad-marks">
                    {ad.trust?.map((mark) => (
                      <li key={mark}><Shield size={14} aria-hidden="true" /> {mark}</li>
                    ))}
                    {videoVerified ? <li data-tk="video-verified"><Shield size={14} aria-hidden="true" /> {videoVerified}</li> : null}
                  </ul>
                ) : null}
              </section>
              <section className="tkn-ad-block" aria-labelledby="tkn-about">
                <h2 id="tkn-about">{personal ? "About me" : t("ad.about")}</h2>
                <p className="tkn-ad-text">{ad.description}</p>
              </section>
              {ad.details?.length ? (
                <section className="tkn-ad-block" aria-labelledby="tkn-details">
                  <h2 id="tkn-details">{t("ad.details")}</h2>
                  <dl className="tkn-det">
                    {ad.details.map((item) => (
                      <div key={item.label} className="tkn-det-tile">
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}
              {sections.map((section) => (
                <section key={section.title} className="tkn-ad-block" aria-label={section.title}>
                  <h2>{section.title === "Where" ? (personal ? "Where we can meet" : "Where") : section.title}</h2>
                  <ul className="tkn-ad-marks">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
              <div className="tkn-ad-share">
                <a href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
                <Link href={`/submit-report/?ad=${ad.publicId || ad.slug || ""}`} prefetch={false} className="tkn-report"><Flag size={14} aria-hidden="true" /> Report</Link>
              </div>
              <p className="tkn-ad-more">
                All ads in <Link href={listHref}><strong>{categoryName} in {city}</strong></Link>
              </p>
            </div>
            <aside className="tkn-ad-side" aria-label="Contact">
              <div className="tkn-contact-panel" data-tk="contact-card">
                {price ? <p className="tkn-ad-price">{price}</p> : null}
                <AdSellerRow name={seller} />
                <ContactButtons />
              </div>
              <section className="tkn-safe" data-tk="security-tips">
                <h2>{t("ad.safe.title")}</h2>
                <p>{t("ad.safe.body")}</p>
                <p>{t("ad.safe.otp")}</p>
                <p className="tkn-fine">{t("ad.safe.fine")}</p>
              </section>
            </aside>
          </div>
          {similar.length ? (
            <section className="tkn-similar" aria-labelledby="tkn-similar">
              <div className="tkn-similar-head">
                <h2 id="tkn-similar">{t("ad.similar.title")}</h2>
                <Link href={listHref} className="tkn-similar-all">{t("ad.similar.all", { category: categoryName })}</Link>
              </div>
              <div className="tkn-ls">
                <div className="tkn-similar-list">
                  {similar.map((item) => (
                    <AdCard key={item.slug} ad={item} layout="row" />
                  ))}
                </div>
              </div>
            </section>
          ) : null}
          <div className={`tkn-ad-bar${peopleAd ? " has-call" : tour ? " has-video" : ""}`} data-tk="bottom-bar">
            <ContactButtons sticky channels={peopleAd ? ["phone", "whatsapp"] : ["whatsapp"]} />
          </div>
        </div>
      </ContactProvider>
    </UiTextProvider>
  );
}
