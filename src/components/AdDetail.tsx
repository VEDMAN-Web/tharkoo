"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MapPin, Shield, Smile, User } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace } from "@/lib/format";
import { listingTagSections } from "@/lib/media";
import { CitySync } from "./CityContext";
import { ContactButtons, ContactProvider } from "./ContactButtons";
import { Gallery } from "./ui/Gallery";
import { AdCard } from "./ui/AdCard";
import { TrackView } from "./ui/RecentlyViewed";

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
}: {
  ad: ListingDoc;
  categoryName: string;
  related?: ListingDoc[];
  listingId?: string;
  crumbs?: { name: string; path: string }[];
}) {
  const title = displayTitle(ad.title) || "Listing";
  const city = prettyPlace(ad.citySlug);
  const district = ad.place && ad.place !== city ? ad.place : prettyPlace(ad.districtSlug);
  const sections = listingTagSections(ad.tags);
  const personal = PERSONAL.has(ad.categorySlug || "");
  const when = ad.publishedAt || ad.createdAt;
  const date = when
    ? new Date(when).toLocaleDateString("en-GB", { day: "2-digit", month: "long" }).toUpperCase()
    : "";
  const listHref = `/${ad.categorySlug}/${ad.citySlug}/`;
  const [copied, setCopied] = useState("");

  function back(event: React.MouseEvent) {
    if (document.referrer && document.referrer.startsWith(window.location.origin)) {
      event.preventDefault();
      window.history.back();
    }
  }

  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/ad/${ad.slug}/`;

  return (
    <ContactProvider listingSlug={ad.slug} listingId={listingId}>
      <div className="tk-ad">
        <TrackView ad={ad} />
        <CitySync name={city} slug={ad.citySlug} />
        <div className="tk-container" style={{ paddingTop: 8 }}>
          <p className="tk-hair" style={{ paddingTop: 10 }}>
            <Link href={listHref} className="tk-back" onClick={back}>
              &lt; Back to search
            </Link>
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
          <section className="tk-summary" data-tk="ad-summary">
            <div className="tk-summary-top">
              <p className="tk-nick">{ad.displayName || title}</p>
              <span className="tk-badge-promo" style={{ position: "static" }}>
                {ad.variant === "supertop" || ad.variant === "star" ? "SUPER Top" : ad.variant === "top" ? "Top" : ad.verified ? "Verified" : categoryName}
              </span>
            </div>
            <div className="tk-attr">
              {ad.age ? (
                <span><User size={14} /> {ad.age} years</span>
              ) : null}
              <span>
                <MapPin size={14} /> <strong>{city}</strong>
                {district ? ` / ${district}` : ""}
              </span>
            </div>
            <h1>{title}</h1>
            <ContactButtons />
          </section>
          <Gallery photos={ad.photos || []} title={title} seed={ad.slug || title} category={ad.categorySlug} />
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
          <div className="tk-hair" />
          <h3 className="tk-contact-h">Contact me</h3>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ContactButtons />
          </div>
          <div className="tk-hair tk-share">
            <div>
              <p style={{ fontWeight: 700 }}>Share ad</p>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl || `/ad/${ad.slug}/`)}`} target="_blank" rel="noopener noreferrer">X</a>
              {" "}
              <a href={`https://wa.me/?text=${encodeURIComponent(shareUrl || `/ad/${ad.slug}/`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <button type="button" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setCopied("Link copied");
                } catch {
                  setCopied("Copy the address bar.");
                }
              }}>Copy</button>
              {copied ? <span> {copied}</span> : null}
            </div>
            <div>
              <Link href={`/submit-report/?ad=${ad.publicId || ad.slug || ""}`}>🛡 Report abuse or fraud</Link>
            </div>
          </div>
          <p className="tk-all">
            All ads in <Link href={listHref}><strong>{categoryName} in {city}</strong></Link> ›
          </p>
          <section className="tk-security" data-tk="security-tips">
            <span className="tk-security-tab"><Shield size={16} /> SECURITY TIPS</span>
            <h3>Security tips</h3>
            <p>Be careful if the advertiser writes in an unusual way or asks for money in advance. Never share OTPs or card details.</p>
          </section>
          <div className="tk-fine">
            <p><strong>Tharkoo does not intervene in relationships between users and advertisers.</strong> People arrange meetings on their own.</p>
            <p>Ads are published on the advertiser&apos;s own responsibility.</p>
            <p>Tharkoo does not verify content beyond its policy.</p>
            <p>The site offers publication and navigation services.</p>
          </div>
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
        <div className="tk-bottom" data-tk="bottom-bar">
          <ContactButtons sticky />
        </div>
      </div>
    </ContactProvider>
  );
}
