import Link from "next/link";
import { Flag, Heart, MapPin, MessageCircle, Shield, Smile, User } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, listingDateLabel, prettyPlace } from "@/lib/format";
import { listingTagSections } from "@/lib/media";
import { CitySync } from "./CityContext";
import { ContactButtons, ContactProvider } from "./ContactButtons";
import { listingPhotos } from "@/lib/media";
import { Gallery } from "./ui/Gallery";
import { SaveButton } from "./ui/SaveButton";
import { AdCard } from "./ui/AdCard";
import { TrackView } from "./ui/RecentlyViewed";
import { BackLink, CopyLinkButton } from "@/app/ad/[slug]/AdClientBits";
import { videoVerifiedLabel } from "./ad/tourLabels";

const PERSONAL = new Set(["dating", "friendship", "meetups", "personal-ads"]);

function serviceLabel(slug?: string) {
  if (slug === "wellness") return "Services";
  if (slug === "jobs") return "Role";
  if (slug === "education") return "Subjects";
  if (PERSONAL.has(slug || "")) return "Interests";
  return "Details";
}

export function AdDetail({
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
  /** Set only when the server says a live video tour can be requested on this ad (H6.5). */
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
  const tier =
    ad.variant === "supertop" || ad.variant === "star"
      ? { key: "supertop", label: "SUPER Top" }
      : ad.variant === "top"
        ? { key: "top", label: "Top" }
        : ad.verified
          ? { key: "verified", label: "Verified" }
          : { key: "category", label: categoryName };
  const nick = ad.displayName && ad.displayName !== title ? ad.displayName : "";

  return (
    <ContactProvider listingSlug={ad.slug} listingId={listingId} tour={tour}>
      <div className="tk-ad">
        <TrackView ad={ad} />
        <CitySync name={city} slug={ad.citySlug} />
        <div className="tk-container" style={{ paddingTop: 8 }}>
          <p className="tk-hair" style={{ paddingTop: 10 }}>
            <BackLink href={listHref}>&lt; Back to search</BackLink>
          </p>
          <nav className="tk-crumbs" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => (
              <span key={crumb.path}>
                {index > 0 ? <span style={{ color: "var(--muted)" }}> / </span> : null}
                <Link href={crumb.path} prefetch={false}>{crumb.name}</Link>
              </span>
            ))}
          </nav>
          <p className="tk-date">
            <strong>{date}</strong>
            {ad.publicId ? ` - Ad ID: ${ad.publicId}` : ""}
          </p>
          <div className="tk-ad-grid">
            <div className="tk-ad-top">
              <section className="tk-summary" data-tk="ad-summary">
                <div className="tk-summary-top">
                  <h1>{title}</h1>
                  <div className="tk-summary-side">
                    <SaveButton
                      item={{ id: ad.slug || title, slug: ad.slug || "", title, place: city, at: 0 }}
                      className="bg-transparent text-accent"
                    />
                    <span className="tk-badge-promo" data-tier={tier.key}>{tier.label}</span>
                  </div>
                </div>
                {nick ? <p className="tk-nick">{nick}</p> : null}
                {ad.trust?.length ? (
                  <div className="tk-attr">
                    {ad.trust.map((mark) => (
                      <span key={mark}><Shield size={14} /> {mark}</span>
                    ))}
                  </div>
                ) : null}
                {videoVerified ? (
                  <div className="tk-attr">
                    <span className="tk-chip" data-tk="video-verified" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
                      <Shield size={14} aria-hidden /> {videoVerified}
                    </span>
                  </div>
                ) : null}
                <div className="tk-attr">
                  {ad.age ? (
                    <span><User size={14} /> {ad.age} years</span>
                  ) : null}
                  <span>
                    <MapPin size={14} /> <strong>{city}</strong>
                    {district ? ` / ${district}` : ""}
                  </span>
                </div>
              </section>
              <Gallery photos={listingPhotos(ad.categorySlug, ad.publicId || ad.slug || "", ad.photos || [])} title={title} seed={ad.slug || title} category={ad.categorySlug} />
            </div>
            <aside className="tk-ad-side">
              <div className="tk-contact-card" data-tk="contact-card">
                <h2>Contact</h2>
                <ContactButtons />
              </div>
            </aside>
            <div className="tk-ad-rest">
          <section className="tk-section">
            <h2><Smile size={16} /> {personal ? "About me" : "About this ad"}</h2>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{ad.description}</p>
          </section>
          {sections[0]?.items.length ? (
            <div className="tk-attr">
              {sections[0].items.map((item) => (
                <span className="tk-chip" key={item}>{item}</span>
              ))}
            </div>
          ) : null}
          {sections.slice(1).map((section) => {
            const label = section.title === "Where" ? (personal ? "Where we can meet" : "Where") : section.title === "Hours" ? (personal ? "Attention to" : "") : serviceLabel(ad.categorySlug);
            if (!label) return null;
            return (
              <section key={section.title} className="tk-section tk-hair">
                <h2>
                  {section.title === "Where" ? <MapPin size={16} /> : section.title === "Hours" ? <User size={16} /> : <Heart size={16} />}
                  {label}
                </h2>
                <div className="tk-attr">
                  {section.items.map((item) => (
                    <span className="tk-chip" key={item}>{item}</span>
                  ))}
                </div>
              </section>
            );
          })}
          <section className="tk-section tk-hair">
            <h2><MapPin size={16} /> Where</h2>
            <p style={{ fontSize: 14 }}>{city}{district ? ` / ${district}` : ""}</p>
          </section>
          {ad.details?.length ? (
            <section className="tk-section tk-hair">
              <h2><Heart size={16} /> {serviceLabel(ad.categorySlug)}</h2>
              <div className="tk-attr">
                {ad.details.map((item) => (
                  <span className="tk-chip" key={item.label}>{item.value}</span>
                ))}
              </div>
            </section>
          ) : null}
          <div className="tk-hair tk-share" data-tk="share-row">
            <div className="tk-share-icons">
              <span>Share:</span>
              <a className="tk-share-btn" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X">X</a>
              <a className="tk-share-btn" href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><MessageCircle size={18} /></a>
              <CopyLinkButton />
            </div>
            <Link className="tk-report" href={`/submit-report/?ad=${ad.publicId || ad.slug || ""}`}><Flag size={14} /> Report</Link>
          </div>
          <p className="tk-all">
            All ads in <Link href={listHref}><strong>{categoryName} in {city}</strong></Link> ›
          </p>
          <section className="tk-security" data-tk="security-tips">
            <h3><Shield size={18} /> Stay safe</h3>
            <p>Be careful if the advertiser writes in an unusual way or asks for money in advance. Never share OTPs or card details.</p>
          </section>
          <p className="tk-fine">
            <strong>Tharkoo does not intervene in relationships between users and advertisers.</strong> People arrange meetings on their own. Ads are published on the advertiser&apos;s own responsibility. Tharkoo does not verify content beyond its policy. The site offers publication and navigation services.
          </p>
          {related.length ? (
            <section>
              <h2 className="t-h2">More like this</h2>
              <div className="tk-feed">
                {related.slice(0, 6).map((item) => (
                  <AdCard key={item.slug} ad={item} />
                ))}
              </div>
            </section>
          ) : null}
            </div>
          </div>
        </div>
        <div className="tk-bottom" data-tk="bottom-bar">
          <ContactButtons sticky />
        </div>
      </div>
    </ContactProvider>
  );
}
