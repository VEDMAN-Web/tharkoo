import Link from "next/link";
import type { ListingDoc } from "@/lib/models";

function Photo({ src, size, count }: { src?: string; size: "sm" | "md" | "xl"; count?: number }) {
  const box =
    size === "xl" ? "h-[180px] w-full" : size === "md" ? "h-[88px] w-[88px]" : "h-16 w-16";
  return (
    <div className={`relative flex-none overflow-hidden bg-[#ddd] ${box}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src || "/placeholders/empty.svg"} alt="" className="h-full w-full object-cover" />
      {count && count > 1 ? (
        <span className="absolute bottom-1 right-1 bg-black/70 px-1 text-[10px] font-bold text-white">{count}</span>
      ) : null}
    </div>
  );
}

export function AdCard({ ad, featured }: { ad: ListingDoc; featured?: boolean }) {
  const href = `/ad/${ad.slug}/`;
  const variant = ad.variant || "free";
  const isStar = variant === "star" || featured;
  const highlight = variant === "highlight" || variant === "flash";
  const superTop = variant === "supertop" || variant === "flash";
  const showPhoto = variant !== "free";
  const photo = ad.photos?.[0];

  return (
    <article
      className="relative border-b border-[#e5e5e5] p-3"
      style={{
        background: isStar ? "#111" : highlight ? "var(--sk-highlight)" : "#fff",
        color: isStar ? "#fff" : "#333",
        boxShadow: superTop ? "inset 0 0 0 3px var(--sk-supertop)" : undefined,
      }}
    >
      {variant !== "free" ? (
        <span
          className="badge absolute right-2 top-2"
          style={{
            background:
              variant === "flash" ? "var(--sk-flash)" : variant === "star" ? "#c9a227" : variant === "supertop" ? "var(--sk-supertop)" : "var(--sk-top)",
          }}
        >
          {variant === "supertop" ? "Super Top" : variant === "flash" ? "Available now" : variant === "star" ? "Star" : "TOP"}
        </span>
      ) : null}
      <div className={`flex gap-3 ${isStar ? "flex-col" : ""}`}>
        {showPhoto ? <Photo src={photo} size={isStar ? "xl" : superTop ? "md" : "sm"} count={ad.photos?.length} /> : null}
        <div className="min-w-0 flex-1">
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
          <p className="mt-2 flex flex-wrap gap-2 text-[12px]" style={{ color: isStar ? "#bbb" : "#888" }}>
            <span>{ad.age} years</span>
            <span>· {ad.citySlug}</span>
            {ad.place ? <span>· {ad.place}</span> : null}
            {ad.verified ? <span className="text-[var(--sk-verified)]">· Verified</span> : null}
          </p>
          {superTop && !isStar ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {ad.phone ? (
                <a className="rounded-sm bg-[var(--sk-call)] px-2 py-1 text-[11px] font-bold text-white no-underline" href={`tel:${ad.phone}`}>
                  Call
                </a>
              ) : null}
              {ad.whatsapp ? (
                <a className="rounded-sm bg-[var(--sk-wa)] px-2 py-1 text-[11px] font-bold text-white no-underline" href={`https://wa.me/91${ad.whatsapp}`}>
                  WhatsApp
                </a>
              ) : null}
              {ad.telegram ? (
                <a className="rounded-sm bg-[var(--sk-tg)] px-2 py-1 text-[11px] font-bold text-white no-underline" href={`https://t.me/${ad.telegram}`}>
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
    <section className="mb-4 border-b border-[#333] bg-[#111] p-3">
      <h2 className="mb-2 text-[16px] font-bold text-white">Discover our Star listings</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ads.map((ad) => (
          <AdCard key={ad.publicId} ad={ad} featured />
        ))}
      </div>
    </section>
  );
}
