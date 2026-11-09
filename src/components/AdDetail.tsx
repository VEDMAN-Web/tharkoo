"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import { prettyPlace } from "@/lib/format";
import { listingTagSections, safePhoto } from "@/lib/media";
import { CitySync } from "./CityContext";
import { ContactButtons } from "./ContactButtons";

const TIPS = [
  "Beware of imposters posing as Tharkoo and asking for money. No one from Tharkoo will claim any payment from you.",
  "Be careful if the advertiser expresses himself incorrectly or strangely. Most scams originate abroad.",
  "Block and report impostors by notifying us and/or the authorities. Enjoy your Tharkoo experience in peace!",
  "Tharkoo never intervenes between the advertiser and the user of the page.",
];

export function AdDetail({
  ad,
  categoryName,
}: {
  ad: ListingDoc;
  categoryName: string;
}) {
  const [photo, setPhoto] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [tip, setTip] = useState(0);
  const photos = (ad.photos?.length ? ad.photos : ["/placeholders/p1.jpg"]).map(safePhoto);
  const city = prettyPlace(ad.citySlug);
  const date = ad.publishedAt
    ? new Date(ad.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" }).toUpperCase()
    : "";
  const variant = ad.variant || "free";
  const sections = listingTagSections(ad.tags);
  const sharePath = `/ad/${ad.slug}/`;

  useEffect(() => {
    const t = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 5000);
    return () => clearInterval(t);
  }, []);

  function shift(dir: number) {
    setPhoto((p) => (p + dir + photos.length) % photos.length);
  }

  return (
    <div className="ad-page">
      <CitySync name={city} />
      <div className="sk-container">
        <div className="date-id">
          <span>
            <b>{date}</b>
          </span>
          {" - "}
          <span>Ad ID: {ad.publicId}</span>
        </div>
        <div className="nickname-border">
          <div className="nickname-row">
            <div className="nickname-title">{ad.displayName}</div>
            {variant === "supertop" || variant === "flash" ? <span className="service-badge-supertop">SuperTop</span> : null}
            {variant === "top" || variant === "highlight" ? <span className="service-badge-top">TOP</span> : null}
            {ad.verified ? <span className="service-badge-verified">Verified</span> : null}
          </div>
          <div className="detail-pills">
            <span className="badge-pill">
              <b>{ad.age} years</b>
            </span>
            <span className="badge-pill">
              <b>{city}</b>
              {ad.place ? ` / ${ad.place}` : ""}
            </span>
          </div>
          <h1 className="ad-main-title">{ad.title}</h1>
          <div className="ad-contact-desktop">
            <ContactButtons phone={ad.phone} whatsapp={ad.whatsapp} telegram={ad.telegram} />
          </div>
        </div>
      </div>

      <div className="post-gallery">
        <button type="button" className="btn-open-modal" onClick={() => setShowAll(true)}>
          Show all
        </button>
        {photos.length > 1 ? (
          <>
            <button type="button" className="gallery-prev" aria-label="Previous" onClick={() => shift(-1)}>
              ‹
            </button>
            <button type="button" className="gallery-next" aria-label="Next" onClick={() => shift(1)}>
              ›
            </button>
          </>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[photo]} alt="Ad photo" />
      </div>

      <div className="sk-container ad-body">
        <div className="service-detail">
          <h5>
            <strong>
              <SmileIcon /> About me
            </strong>
          </h5>
          <p className="ad-description">{ad.description}</p>
          {sections.map((s) => (
            <div key={s.title || "traits"} className="tags-list-detail">
              {s.title ? (
                <>
                  <hr />
                  <h5>
                    <strong>
                      {s.icon === "heart" ? <HeartIcon /> : s.icon === "map" ? <MapIcon /> : <UserIcon />} {s.title}
                    </strong>
                  </h5>
                </>
              ) : null}
              <p>
                {s.items.map((item) => (
                  <span key={item} className="badge-pill">
                    {item}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>

        <hr className="ad-hr" />
        <h4 className="contact-heading">Contact me</h4>
        <div className="ad-contact-desktop">
          <ContactButtons phone={ad.phone} whatsapp={ad.whatsapp} telegram={ad.telegram} />
        </div>

        <hr className="ad-hr" />
        <div className="ad-share">
          <div>
            <h6>Share ad</h6>
            <div className="share-row">
              <a
                className="share-ic"
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(sharePath)}&text=${encodeURIComponent(ad.title || "")}`}
                target="_blank"
                rel="nofollow noopener noreferrer"
                aria-label="Share on X"
              >
                𝕏
              </a>
              <a
                className="share-ic"
                href={`https://wa.me/?text=${encodeURIComponent(`Hi, I just saw this ad on Tharkoo: ${sharePath}`)}`}
                target="_blank"
                rel="nofollow noopener noreferrer"
                aria-label="Share on WhatsApp"
              >
                <WaShare />
              </a>
            </div>
          </div>
          <Link href={`/submit-report/?ad=${ad.publicId}`} className="report-link no-underline">
            <ShieldIcon /> Report abuse or fraud
          </Link>
        </div>

        <p className="all-ads-link">
          All ads in{" "}
          <Link href={`/${ad.categorySlug}/${ad.citySlug}/`} className="no-underline">
            <b>
              {categoryName}
              <br />
              in {city} →
            </b>
          </Link>
        </p>

        <div className="report-abuse">
          <h6>
            <ShieldIcon /> Official channels for reporting
          </h6>
          <p>
            If you detect inappropriate, illegal content or misuse of data, please contact us through the following
            channels:
          </p>
          <ul>
            <li>
              To report unauthorized use of photos, personal information (such as phone numbers, emails, names, or
              addresses), or potential intellectual property violations, please email us at <strong>privacy@tharkoo.com</strong>
            </li>
            <li>
              To report illegal or abusive content, or anything that violates our Terms of Use, please email us at{" "}
              <strong>grievances@tharkoo.com</strong>
            </li>
          </ul>
        </div>

        <div className="alert-tips">
          <div className="tips-title">Security tips</div>
          <p>{TIPS[tip]}</p>
        </div>
      </div>

      <div className="ad-contact-mobile">
        <ContactButtons phone={ad.phone} whatsapp={ad.whatsapp} telegram={ad.telegram} sticky />
      </div>

      {showAll ? (
        <div className="gallery-modal" role="dialog">
          <button type="button" className="gallery-modal-back" onClick={() => setShowAll(false)}>
            ‹ Back to the ad
          </button>
          <div className="gallery-modal-list">
            {photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src + i} src={src} alt="" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SmileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 496 512" aria-hidden>
      <path
        fill="currentColor"
        d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm0 448c-110.3 0-200-89.7-200-200S137.7 56 248 56s200 89.7 200 200-89.7 200-200 200zm117.8-146.4c-10.2-8.5-25.3-7.1-33.8 3.1-20.8 25-51.5 39.4-84 39.4s-63.2-14.3-84-39.4c-8.5-10.2-23.7-11.5-33.8-3.1-10.2 8.5-11.5 23.6-3.1 33.8 30 36 74.1 56.6 120.9 56.6s90.9-20.6 120.9-56.6c8.5-10.2 7.1-25.3-3.1-33.8zM168 240c17.7 0 32-14.3 32-32s-14.3-32-32-32-32 14.3-32 32 14.3 32 32 32zm160-60c-25.7 0-55.9 16.9-59.9 42.1-1.7 11.2 11.5 18.2 19.8 10.8l9.5-8.5c14.8-13.2 46.2-13.2 61 0l9.5 8.5c8.5 7.4 21.6.3 19.8-10.8-3.8-25.2-34-42.1-59.7-42.1z"
      />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="26" height="26" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="26" height="26" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="26" height="26" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="20" height="20" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
    </svg>
  );
}
function WaShare() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden>
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
    </svg>
  );
}
