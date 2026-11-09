import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import { prettyPlace } from "@/lib/format";

function Photo({ src, size, count }: { src?: string; size: "sm" | "md" | "xl"; count?: number }) {
  const box =
    size === "xl" ? "h-[168px] w-full" : size === "md" ? "h-[96px] w-[96px]" : "h-[72px] w-[72px]";
  return (
    <div className={`relative flex-none overflow-hidden bg-[#ddd] ${box}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src || "/placeholders/empty.svg"} alt="" className="h-full w-full object-cover" />
      {count && count > 1 ? (
        <span className="absolute bottom-1 right-1 bg-black/70 px-1.5 text-[10px] font-bold text-white">{count}</span>
      ) : null}
    </div>
  );
}

function variantLabel(variant: string) {
  if (variant === "supertop") return "Super Top";
  if (variant === "flash") return "Available now";
  if (variant === "star") return "Star";
  if (variant === "highlight") return "TOP";
  if (variant === "top") return "TOP";
  return "";
}

export function AdCard({ ad, featured }: { ad: ListingDoc; featured?: boolean }) {
  const href = `/ad/${ad.slug}/`;
  const variant = ad.variant || "free";
  const isStar = variant === "star" || featured;
  const highlight = variant === "highlight" || variant === "flash";
  const superTop = variant === "supertop" || variant === "flash";
  const showPhoto = variant !== "free";
  const photo = ad.photos?.[0];
  const label = variantLabel(variant);
  const city = prettyPlace(ad.citySlug);

  return (
    <article
      className="ad-card"
      style={{
        background: isStar ? "#111" : highlight ? "var(--sk-highlight)" : "#fff",
        color: isStar ? "#fff" : "#333",
        boxShadow: superTop && !isStar ? "inset 0 0 0 3px var(--sk-supertop)" : undefined,
      }}
    >
      {label ? (
        <span
          className="badge absolute right-3 top-3"
          style={{
            background:
              variant === "flash" ? "var(--sk-flash)" : variant === "star" ? "#c9a227" : variant === "supertop" ? "var(--sk-supertop)" : "var(--sk-top)",
          }}
        >
          {label}
        </span>
      ) : null}
      <div className={`flex gap-3 ${isStar ? "flex-col" : ""}`}>
        {showPhoto ? <Photo src={photo} size={isStar ? "xl" : superTop ? "md" : "sm"} count={ad.photos?.length} /> : null}
        <div className="min-w-0 flex-1 pr-10">
          <Link
            href={href}
            className="block text-[15px] font-bold leading-snug no-underline hover:underline"
            style={{ color: isStar ? "#fff" : "#222" }}
          >
            {ad.title}
          </Link>
          <p className="mt-1 line-clamp-3 text-[13px] leading-5" style={{ color: isStar ? "#ccc" : "#666" }}>
            {ad.description}
          </p>
          <p className="mt-2 text-[12px]" style={{ color: isStar ? "#bbb" : "#888" }}>
            <span>{ad.age} years</span>
            <span> {city}</span>
            {ad.place ? <span> / {ad.place}</span> : null}
            {ad.verified ? <span className="ml-2 text-[var(--sk-verified)]">Verified</span> : null}
          </p>
          {superTop && !isStar ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {ad.phone ? (
                <a className="rounded-[2px] bg-[var(--sk-call)] px-3 py-1.5 text-[12px] font-bold text-white no-underline" href={`tel:${ad.phone}`}>
                  Call
                </a>
              ) : null}
              {ad.whatsapp ? (
                <a className="rounded-[2px] bg-[var(--sk-wa)] px-3 py-1.5 text-[12px] font-bold text-white no-underline" href={`https://wa.me/91${ad.whatsapp}`}>
                  WhatsApp
                </a>
              ) : null}
              {ad.telegram ? (
                <a className="rounded-[2px] bg-[var(--sk-tg)] px-3 py-1.5 text-[12px] font-bold text-white no-underline" href={`https://t.me/${ad.telegram}`}>
                  Telegram
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function StarStrip({ ads }: { ads: ListingDoc[] }) {
  if (!ads.length) return null;
  return (
    <section className="bg-[#111] p-3">
      <h2 className="mb-2 text-[16px] font-bold text-white">Discover our Star listings</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ads.map((ad) => (
          <AdCard key={ad.publicId} ad={ad} featured />
        ))}
      </div>
    </section>
  );
}
