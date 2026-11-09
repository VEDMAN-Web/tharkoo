import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import { prettyPlace } from "@/lib/format";
import { safePhoto } from "@/lib/media";
import { ContactButtons } from "./ContactButtons";

function variantLabel(variant: string) {
  if (variant === "supertop") return "SuperTop";
  if (variant === "flash") return "Available now";
  if (variant === "star") return "Star";
  if (variant === "highlight") return "TOP";
  if (variant === "top") return "TOP";
  return "";
}

export function AdCard({ ad, featured }: { ad: ListingDoc; featured?: boolean }) {
  const href = `/ad/${ad.slug}/`;
  const variant = ad.variant || "free";
  const photo = ad.photos?.[0];
  const showPhoto = Boolean(photo) && variant !== "free";
  const superTop = variant === "supertop" || variant === "flash";
  const label = variantLabel(variant);
  const city = prettyPlace(ad.citySlug);
  const classes = [
    "item-card",
    `item-${variant}`,
    superTop ? "item-supertop-border" : "",
    ad.verified ? "item-verified" : "",
    featured ? "item-star" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes}>
      {showPhoto ? (
        <Link href={href} className={`item-image item-image-${superTop ? "supertop" : "top"} no-underline`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={safePhoto(photo)} alt="" />
          {ad.photos && ad.photos.length > 1 ? <span className="item-photo-count">{ad.photos.length}</span> : null}
        </Link>
      ) : null}
      <div className="item-container">
        {label ? <span className={`item-badge item-badge-${variant}`}>{label}</span> : null}
        <Link href={href} className="item-title no-underline">
          {ad.title}
        </Link>
        <p className="item-description">{ad.description}</p>
        <p className="item-meta">
          <span>{ad.age} years</span>
          <span>{city}</span>
          {ad.place ? <span>/ {ad.place}</span> : null}
        </p>
        {superTop && !featured ? (
          <ContactButtons phone={ad.phone} whatsapp={ad.whatsapp} telegram={ad.telegram} compact />
        ) : null}
      </div>
      {ad.verified ? (
        <div className="verified-footer">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Verified
        </div>
      ) : null}
    </article>
  );
}

export function StarStrip({ ads }: { ads: ListingDoc[] }) {
  if (!ads.length) return null;
  return (
    <section className="star-strip">
      <h2>Discover our Star listings</h2>
      <div className="star-strip-grid">
        {ads.map((ad) => (
          <AdCard key={ad.publicId} ad={ad} featured />
        ))}
      </div>
    </section>
  );
}
