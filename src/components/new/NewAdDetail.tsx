import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace, shortDateLabel } from "@/lib/format";
import type { AdChannel } from "@/server/listings/contact-channels";
import { ContactButtons, ContactProvider, type ContactPopupInfo } from "@/components/ContactButtons";
import { ContactPressCounter } from "./ContactPressCounter";
import { UiTextProvider } from "@/components/ui/AdCard";
import { TrackView } from "@/components/ui/RecentlyViewed";
import { adHref, citiesPath, joinPath, placePath, postAdPath, type UrlPaths } from "@/lib/urls";
import { isCityAlias } from "@/lib/seo/district-alias";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import { PostStrip } from "@/components/ui/PostStrip";
import { CitySync } from "@/components/CityContext";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { AdSellerRow } from "./AdLiveBits";
import { MoreInCity } from "./MoreInCity";
import { SIMILAR_ADS_MAX, SimilarAds } from "./SimilarAds";
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
        href: adHref(paths, item),
        title: displayTitle(item.title) || "Listing",
        place: district ? `${city} / ${district}` : city,
        photo: item.photos?.[0] ?? null,
      };
    });
}

export function NewAdDetail({
  ad,
  categoryName,
  related = [],
  listingId,
  ownerId,
  videos = [],
  paths,
  memberSince = "",
  heading,
  tour,
  peopleAd = false,
  features = { price: true, contact: true },
  contactChannels,
  paymentsLive = false,
  alternatives = [],
  sellerName = "",
  sellerPhoto = null,
  texts,
}: {
  ad: ListingDoc;
  categoryName: string;
  related?: ListingDoc[];
  listingId?: string;
  videos?: AdVideo[];
  paths: UrlPaths;
  memberSince?: string;
  /** The route passes the SEO crumbs for the page markup; the page shows its own place crumbs. */
  crumbs?: { name: string; path: string }[];
  ownerId?: string;
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
  /** The advertiser's profile photo, when they added one. */
  sellerPhoto?: string | null;
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
  const similar = related.filter((item) => item.slug !== ad.slug).slice(0, SIMILAR_ADS_MAX);
  const popupInfo: ContactPopupInfo = { sellerName: seller, sellerPhoto, paymentsLive, alternatives };
  const since = memberSinceLabel(memberSince);
  const cardLabels = {
    online: t("home.ads.online"),
    watermark: t("home.ads.watermark"),
    photoPrev: t("home.ads.photoPrev"),
    photoNext: t("home.ads.photoNext"),
    chat: t("home.ads.chat"),
    age: t("home.ads.age"),
    counts: { views: t("home.ads.views"), viewOne: t("home.ads.viewOne"), clicks: t("card.clicks"), clickOne: t("card.clickOne") },
  };
  // H19.2: Tharkoo India / City / Area. The category is never glued to the city name.
  const placeCrumbs = [
    { name: t("ad.crumb.home"), path: "/" },
    ...(ad.citySlug && city ? [{ name: city, path: placePath(ad.categorySlug || "", ad.citySlug) }] : []),
    ...(ad.citySlug && ad.districtSlug && district ? [{ name: district, path: placePath(ad.categorySlug || "", ad.citySlug, ad.districtSlug) }] : []),
  ];
  const barChannels = channelsFor(peopleAd ? ["phone", "whatsapp"] : ["whatsapp"], contactChannels);
  const barClass = barClassOf(barChannels.length + 1 + (tour && !peopleAd ? 1 : 0), peopleAd);
  const sampleNote = ad.sample ? { message: t("demo.message"), button: t("demo.postButton"), href: postAdPath(paths) } : null;
  const actionProps = { slug: ad.slug || "", publicId: ad.publicId || "", address: ad.address, title, place: placeText };

  return (
    <UiTextProvider texts={texts}>
      <ContactProvider listingSlug={ad.slug} listingId={listingId} ownerId={ownerId} tour={tour} peopleAd={peopleAd} info={popupInfo} sample={sampleNote}>
        <ContactPressCounter slug={ad.slug ?? ""}>
        <div className="tkn-page tkn-ad" data-tk="new-ad">
          <TrackView ad={ad} />
          <CitySync name={city} slug={ad.citySlug} />
          <nav className="tkn-ad-crumbs" aria-label="Breadcrumb">
            {placeCrumbs.map((crumb, index) => (
              <span key={crumb.path}>
                {index > 0 ? <span aria-hidden="true"> / </span> : null}
                <Link href={crumb.path} prefetch={false}>{crumb.name}</Link>
              </span>
            ))}
          </nav>
          <div className="tkn-ad-grid">
            <PictureHeight />
            <div className="tkn-ad-main">
              <NewGallery photos={photos} videos={videos} title={title} place={district || city} isNew={isRecent(ad)} />
              <article className="tkn-ad-card" data-tk="ad-summary">
                <div className="tkn-ad-titlerow">
                  <h1>{title}</h1>
                  <AdActions {...actionProps} icons />
                </div>
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
                {ad.interests?.length ? (
                  <ul className="tkn-ad-interests" aria-label={t("ad.interests")} data-tk="ad-interests">
                    {ad.interests.slice(0, 5).map((word) => (
                      <li key={word}>{word}</li>
                    ))}
                  </ul>
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
                  <AdSellerRow name={seller} photo={sellerPhoto} verified={Boolean(ad.verified)} since={since} />
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
              fallbackTitle={t("card.fallbackTitle")}
              labels={cardLabels}
            />
          ) : null}
          {ad.citySlug && city ? <MoreInCity href={joinPath(citiesPath(paths), ad.citySlug)} text={t("ad.moreInCity", { city })} /> : null}
          <PostStrip text={t("post.strip.text")} button={t("post.strip.button")} feeText={t("post.strip.fee")} />
          {features.contact && !ad.sample ? (
            <div className={`tkn-ad-bar${barClass}`} data-tk="bottom-bar">
              <ContactButtons sticky channels={barChannels} />
            </div>
          ) : null}
        </div>
        </ContactPressCounter>
      </ContactProvider>
    </UiTextProvider>
  );
}
