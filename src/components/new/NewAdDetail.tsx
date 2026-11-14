import Link from "next/link";
import { Flag, MapPin, Shield } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, listingDateLabel, prettyPlace } from "@/lib/format";
import { listingPhotos, listingTagSections } from "@/lib/media";
import { CitySync } from "@/components/CityContext";
import { ContactButtons, ContactProvider } from "@/components/ContactButtons";
import { SaveButton } from "@/components/ui/SaveButton";
import { AdCard } from "@/components/ui/AdCard";
import { TrackView } from "@/components/ui/RecentlyViewed";
import { videoVerifiedLabel } from "@/components/ad/tourLabels";
import { BackLink } from "@/app/ad/[slug]/AdClientBits";
import { NewGallery } from "./NewGallery";
import "./new-design.css";

const PERSONAL = new Set(["dating", "friendship", "meetups", "personal-ads"]);

function tierOf(ad: ListingDoc, categoryName: string) {
  if (ad.variant === "supertop" || ad.variant === "star") return { key: "supertop", label: "SUPER Top" };
  if (ad.variant === "top") return { key: "top", label: "Top" };
  if (ad.verified) return { key: "verified", label: "Verified" };
  return { key: "category", label: categoryName };
}

/**
 * H7.4: the ad page in the New design, as in the AdPage mockup. Gallery, details, a sticky glass contact panel,
 * similar ads with the listing card, and on phones a fixed bottom bar with WhatsApp, Chat and Video call.
 * The video call is offered only when the server says a tour is allowed (people categories never get one).
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
}: {
  ad: ListingDoc;
  categoryName: string;
  related?: ListingDoc[];
  listingId?: string;
  crumbs?: { name: string; path: string }[];
  shareUrl: string;
  heading?: string;
  tour?: { listingId: string; coins: number } | null;
}) {
  const title = heading || displayTitle(ad.title) || "Listing";
  const videoVerified = videoVerifiedLabel(ad.videoVerifiedUntil);
  const city = prettyPlace(ad.citySlug);
  const district = ad.place && ad.place !== city ? ad.place : prettyPlace(ad.districtSlug);
  const sections = listingTagSections(ad.tags);
  const personal = PERSONAL.has(ad.categorySlug || "");
  const date = listingDateLabel(ad.publishedAt || ad.createdAt);
  const listHref = `/${ad.categorySlug}/${ad.citySlug}/`;
  const tier = tierOf(ad, categoryName);
  const photos = listingPhotos(ad.categorySlug, ad.publicId || ad.slug || "", ad.photos || []);

  return (
    <ContactProvider listingSlug={ad.slug} listingId={listingId} tour={tour}>
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
            <NewGallery photos={photos} title={title} />
            <section className="tkn-ad-head" data-tk="ad-summary">
              <div className="tkn-ad-titlerow">
                <h1>{title}</h1>
                <div className="tkn-ad-side-tags">
                  <SaveButton item={{ id: ad.slug || title, slug: ad.slug || "", title, place: city, at: 0 }} className="bg-transparent text-accent" />
                  <span className="tkn-tier" data-tier={tier.key}>{tier.label}</span>
                </div>
              </div>
              <p className="tkn-ad-meta">
                <MapPin size={14} aria-hidden="true" /> <strong>{city}</strong>
                {district ? ` / ${district}` : ""}
                {ad.age ? ` · ${ad.age} years` : ""}
              </p>
              <p className="tkn-ad-date">
                <strong>{date}</strong>
                {ad.publicId ? ` · Ad ID: ${ad.publicId}` : ""}
              </p>
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
              <h2 id="tkn-about">{personal ? "About me" : "About this ad"}</h2>
              <p className="tkn-ad-text">{ad.description}</p>
            </section>
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
            {ad.details?.length ? (
              <section className="tkn-ad-block">
                <h2>Details</h2>
                <ul className="tkn-ad-marks">
                  {ad.details.map((item) => (
                    <li key={item.label}>{item.label}: {item.value}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div className="tkn-ad-share">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
              <Link href={`/submit-report/?ad=${ad.publicId || ad.slug || ""}`} prefetch={false} className="tkn-report"><Flag size={14} aria-hidden="true" /> Report</Link>
            </div>
            <p className="tkn-ad-more">
              All ads in <Link href={listHref}><strong>{categoryName} in {city}</strong></Link>
            </p>
            <section className="tkn-ad-safe" data-tk="security-tips">
              <h2><Shield size={18} aria-hidden="true" /> Stay safe</h2>
              <p>Be careful if the advertiser writes in an unusual way or asks for money in advance. Never share OTPs or card details.</p>
              <p className="tkn-fine">Tharkoo does not intervene in relationships between users and advertisers. People arrange meetings on their own.</p>
            </section>
          </div>
          <aside className="tkn-ad-side" aria-label="Contact">
            <div className="tkn-contact-panel" data-tk="contact-card">
              <h2>Contact</h2>
              <ContactButtons />
            </div>
          </aside>
        </div>
        {related.length ? (
          <section className="tkn-similar" aria-labelledby="tkn-similar">
            <h2 id="tkn-similar" className="tkn-h2">Similar ads near you</h2>
            <div className="tkn-similar-list">
              {related.slice(0, 4).map((item) => (
                <AdCard key={item.slug} ad={item} />
              ))}
            </div>
          </section>
        ) : null}
        <div className="tkn-ad-bar" data-tk="bottom-bar">
          <ContactButtons sticky channels={["whatsapp"]} />
        </div>
      </div>
    </ContactProvider>
  );
}
