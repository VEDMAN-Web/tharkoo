import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace, shortDateLabel } from "@/lib/format";
import type { AdChannel } from "@/server/listings/contact-channels";
import { ContactButtons, ContactProvider, type ContactPopupInfo } from "@/components/ContactButtons";
import { UiTextProvider } from "@/components/ui/AdCard";
import { TrackView } from "@/components/ui/RecentlyViewed";
import { adPath, postAdPath, type UrlPaths } from "@/lib/urls";
import { isCityAlias } from "@/lib/seo/district-alias";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import { PostStrip } from "@/components/ui/PostStrip";
import { formatPrice } from "@/components/search/price";
import { CitySync } from "@/components/CityContext";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { AdSellerRow } from "./AdLiveBits";
import { SIMILAR_ADS_MAX, SimilarAds } from "./SimilarAds";
import { rowLabels } from "./listing-row-data";
import { PictureHeight } from "./PictureHeight";
import { ReadMoreText } from "./ReadMoreText";
import { AdActions } from "./AdActions";
import { NewGallery } from "./NewGallery";
import type { AdVideo } from "@/server/media/video";
import type { AdPopupAlt } from "./AdPopup";
import "./new-design.css";
import "./listing-spec.css";
import "./ad-spec.css";

const PERSONAL = new Set(["dating", "friendship", "meetups", "personal-ads"]);
const GOLD_TIERS = new Set(["supertop", "top"]);
const PRICED_PEOPLE = new Set(["wellness"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function tierOf(ad: ListingDoc, categoryName: string) {
  if (ad.variant === "supertop" || ad.variant === "star") return { key: "supertop", label: "SUPER Top" };
  if (ad.variant === "top") return { key: "top", label: "Top" };
  if (ad.verified) return { key: "verified", label: "Verified" };
  return { key: "category", label: categoryName };
}

function memberSinceLabel(value: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function channelsFor(wanted: AdChannel[], available?: AdChannel[]) {
  return available ? wanted.filter((channel) => available.includes(channel)) : wanted;
}

function barClassOf(buttons: number, peopleAd: boolean) {
  if (buttons === 1) return " has-one";
  if (buttons === 3) return peopleAd ? " has-call" : " has-video";
  return "";
}

function isRecent(ad: ListingDoc) {
  return Date.now() - new Date(ad.publishedAt || ad.createdAt || 0).getTime() < DAY_MS;
}

function placeOf(ad: ListingDoc) {
  const city = prettyPlace(ad.citySlug);
  const named = ad.place && ad.place !== city ? ad.place : prettyPlace(ad.districtSlug);
  return { city, district: named && !isCityAlias(city, named) ? named : "" };
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
        photo: item.photos?.[0] ?? null,
      };
    });
}

export function NewAdDetail({
  ad,
  categoryName,
  related = [],
  listingId,
  videos = [],
  paths,
  memberSince = "",
  crumbs = [],
  heading,
  tour,
  peopleAd = false,
  features = { price: true, contact: true },
  contactChannels,
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
  videos?: AdVideo[];
  paths: UrlPaths;
  memberSince?: string;
  crumbs?: { name: string; path: string }[];
  shareUrl: string;
  heading?: string;
  tour?: { listingId: string; coins: number } | null;
  peopleAd?: boolean;
  /** H7.167: what the kind of this category turns on. */
  features?: { price: boolean; contact: boolean };
  contactChannels?: AdChannel[];
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
  const photos = ad.photos || [];
  const seller = sellerName?.trim() || t("ad.seller.name");
  const price = formatPrice(ad.price);
  const similar = related.filter((item) => item.slug !== ad.slug).slice(0, SIMILAR_ADS_MAX);
  const popupInfo: ContactPopupInfo = { sellerName: seller, paymentsLive, alternatives };
  const priceText = price ? `${price}${priceUnit ? ` / ${priceUnit}` : ""}` : "";
  const since = memberSinceLabel(memberSince);
  const cardLabels = {
    online: t("home.ads.online"),
    watermark: t("home.ads.watermark"),
    photoPrev: t("home.ads.photoPrev"),
    photoNext: t("home.ads.photoNext"),
    chat: t("home.ads.chat"),
    age: t("home.ads.age"),
    row: rowLabels(t),
  };
  const categoryCrumb = crumbs[1]?.path;
  const cityCrumb = crumbs.find((crumb) => crumb.name === `${city} ${categoryName}`)?.path;
  const barChannels = channelsFor(peopleAd ? ["phone", "whatsapp"] : ["whatsapp"], contactChannels);
  const barClass = barClassOf(barChannels.length + 1 + (tour && !peopleAd ? 1 : 0), peopleAd);
  const showPrice = features.price && (!peopleAd || PRICED_PEOPLE.has(ad.categorySlug || ""));
  const sampleNote = ad.sample ? { message: t("demo.message"), button: t("demo.postButton"), href: postAdPath(paths) } : null;
  const actionProps = { slug: ad.slug || "", publicId: ad.publicId || "", title, place: placeText };

  return (
    <UiTextProvider texts={texts}>
      <ContactProvider listingSlug={ad.slug} listingId={listingId} tour={tour} peopleAd={peopleAd} info={popupInfo} sample={sampleNote}>
        <div className="tkn-page tkn-ad" data-tk="new-ad">
          <TrackView ad={ad} />
          <CitySync name={city} slug={ad.citySlug} />
          <nav className="tkn-ad-crumbs" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => (
              <span key={crumb.path} data-phone={crumb.path === categoryCrumb ? "first" : crumb.path === cityCrumb ? "show" : undefined}>
                {index > 0 ? <span aria-hidden="true"> / </span> : null}
                <Link href={crumb.path} prefetch={false}>{crumb.name}</Link>
              </span>
            ))}
          </nav>
          <div className="tkn-ad-grid">
            <PictureHeight />
            <div className="tkn-ad-main">
              <NewGallery photos={photos} videos={videos} title={title} isNew={isRecent(ad)} />
              <article className="tkn-ad-card" data-tk="ad-summary">
                <div className="tkn-ad-titlerow">
                  <h1>{title}</h1>
                  <AdActions {...actionProps} icons />
                </div>
                {!showPrice ? null : <p className={priceText ? "tkn-ad-phoneprice" : "tkn-ad-phoneprice is-request"}>{priceText || t("ad.price.request")}</p>}
                <div className="tkn-ad-subrow">
                  <p className="tkn-ad-meta">{t("ad.meta.simple", { place: placeText, date })}</p>
                  <ul className="tkn-ad-pills" aria-label={t("ad.details")}>
                    {ad.sample ? <li className="is-sample" data-tk="sample-pill">{t("demo.pill")}</li> : null}
                    {GOLD_TIERS.has(tier.key) ? <li className="is-featured">{t("ad.pill.featured")}</li> : null}
                    <li>{categoryName}</li>
                    {city ? <li>{city}</li> : null}
                    {ad.verified ? (
                      <li className="is-verified">
                        <BadgeCheck size={14} aria-hidden />
                        {t("ad.pill.verified")}
                      </li>
                    ) : null}
                  </ul>
                </div>
                {sampleNote ? (
                  <aside className="tkn-ad-sample" data-tk="sample-banner">
                    <p>{sampleNote.message}</p>
                    <a className="tk-btn" href={sampleNote.href}>{sampleNote.button}</a>
                  </aside>
                ) : null}
                <hr className="tkn-ad-rule" />
                <section aria-labelledby="tkn-about">
                  <h2 id="tkn-about">{personal ? t("ad.aboutMe") : t("ad.about")}</h2>
                  <ReadMoreText text={ad.description || ""} more={t("ad.readMore")} less={t("ad.readLess")} />
                </section>
                {ad.details?.length ? (
                  <>
                    <hr className="tkn-ad-rule" />
                    <section aria-labelledby="tkn-details">
                      <h2 id="tkn-details">{t("ad.details")}</h2>
                      <dl className="tkn-det">
                        {ad.details.map((item) => (
                          <div key={item.label} className="tkn-det-item">
                            <dt>{item.label}</dt>
                            <dd>{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  </>
                ) : null}
              </article>
            </div>
            <aside className="tkn-ad-side" aria-label={t("ad.contact.label")}>
              <div className="tkn-ad-sticky">
                <div className="tkn-contact-panel" data-tk="contact-card">
                  {!showPrice ? null : <p className={priceText ? "tkn-ad-price" : "tkn-ad-price is-request"}>{priceText || t("ad.price.request")}</p>}
                  <AdSellerRow name={seller} verified={Boolean(ad.verified)} since={since} />
                  {features.contact && !ad.sample ? <ContactButtons channels={channelsFor(["phone", "whatsapp"], contactChannels)} /> : null}
                  <AdActions {...actionProps} />
                </div>
                <section className="tkn-safe" data-tk="security-tips">
                  <ShieldCheck size={22} aria-hidden className="tkn-safe-icon" />
                  <div>
                    <h2>{t("ad.safe.title")}</h2>
                    <p>{peopleAd ? t("ad.safe.bodyPeople") : t("ad.safe.body")}</p>
                    <p>{t("ad.safe.otp")}</p>
                    <Link href="/help/" prefetch={false} className="tkn-safe-more">{t("ad.safe.more")}</Link>
                  </div>
                </section>
                {peopleAd ? <p className="tkn-fine">{t("ad.safe.fine")}</p> : null}
              </div>
            </aside>
          </div>
          {similar.length ? (
            <SimilarAds
              ads={similar}
              categorySlug={ad.categorySlug || ""}
              categoryName={categoryName}
              paths={paths}
              title={t("ad.similar.title")}
              allText={t("ad.similar.all", { category: categoryName })}
              allHref={listHref}
              listLabel={t("ad.similar.list")}
              prevLabel={t("ad.similar.prev")}
              nextLabel={t("ad.similar.next")}
              fallbackTitle={t("card.fallbackTitle")}
              labels={cardLabels}
            />
          ) : null}
          <PostStrip text={t("post.strip.text")} button={t("post.strip.button")} feeText={t("post.strip.fee")} />
          {features.contact && !ad.sample ? (
            <div className={`tkn-ad-bar${barClass}`} data-tk="bottom-bar">
              <ContactButtons sticky channels={barChannels} />
            </div>
          ) : null}
        </div>
      </ContactProvider>
    </UiTextProvider>
  );
}
