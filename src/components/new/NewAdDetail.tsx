import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace, shortDateLabel } from "@/lib/format";
import { listingPhotos } from "@/lib/media";
import { ContactButtons, ContactProvider, type ContactPopupInfo } from "@/components/ContactButtons";
import { AdCard, UiTextProvider } from "@/components/ui/AdCard";
import { TrackView } from "@/components/ui/RecentlyViewed";
import { adPath, type UrlPaths } from "@/lib/urls";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import { formatPrice } from "@/components/search/price";
import { CitySync } from "@/components/CityContext";
import { AdMetaLine, AdSellerRow } from "./AdLiveBits";
import { AdActions } from "./AdActions";
import { NewGallery } from "./NewGallery";
import type { AdPopupAlt } from "./AdPopup";
import "./new-design.css";
import "./listing-spec.css";
import "./ad-spec.css";

const PERSONAL = new Set(["dating", "friendship", "meetups", "personal-ads"]);
const GOLD_TIERS = new Set(["supertop", "top"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function tierOf(ad: ListingDoc, categoryName: string) {
  if (ad.variant === "supertop" || ad.variant === "star") return { key: "supertop", label: "SUPER Top" };
  if (ad.variant === "top") return { key: "top", label: "Top" };
  if (ad.verified) return { key: "verified", label: "Verified" };
  return { key: "category", label: categoryName };
}

function isRecent(ad: ListingDoc) {
  return Date.now() - new Date(ad.publishedAt || ad.createdAt || 0).getTime() < DAY_MS;
}

function placeOf(ad: ListingDoc) {
  const city = prettyPlace(ad.citySlug);
  const district = ad.place && ad.place !== city ? ad.place : prettyPlace(ad.districtSlug);
  return { city, district };
}

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

export function NewAdDetail({
  ad,
  categoryName,
  related = [],
  listingId,
  crumbs = [],
  heading,
  tour,
  peopleAd = false,
  paymentsLive = false,
  alternatives = [],
  sellerName = "",
  priceUnit = "",
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
  peopleAd?: boolean;
  paymentsLive?: boolean;
  alternatives?: AdPopupAlt[];
  sellerName?: string;
  priceUnit?: string;
  texts?: UiTextMap;
}) {
  const t = makeT(texts);
  const title = heading || displayTitle(ad.title) || "Listing";
  const { city, district } = placeOf(ad);
  const placeText = district ? `${city} / ${district}` : city;
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
              <NewGallery photos={photos} title={title} badge={GOLD_TIERS.has(tier.key) ? tier.label : null} isNew={isRecent(ad)} />
              <section className="tkn-ad-head" data-tk="ad-summary">
                <h1>{title}</h1>
                <AdMetaLine slug={ad.slug || ""} place={placeText} posted={date} />
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
            </div>
            <aside className="tkn-ad-side" aria-label="Contact">
              <div className="tkn-contact-panel" data-tk="contact-card">
                {peopleAd ? null : <p className="tkn-ad-price">{price ? `${price}${priceUnit ? ` / ${priceUnit}` : ""}` : "Price on request"}</p>}
                <AdSellerRow name={seller} />
                <ContactButtons />
                <AdActions slug={ad.slug || ""} publicId={ad.publicId || ""} title={title} place={placeText} />
              </div>
              <section className="tkn-safe" data-tk="security-tips">
                <h2>{t("ad.safe.title")}</h2>
                <p>{peopleAd ? t("ad.safe.bodyPeople") : t("ad.safe.body")}</p>
                <p>{t("ad.safe.otp")}</p>
                {peopleAd ? <p className="tkn-fine">{t("ad.safe.fine")}</p> : null}
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
