import Link from "next/link";
import type { ListingDoc } from "@/lib/models";

function Thumb({ letter, size }: { letter: string; size: "sm" | "md" | "xl" }) {
  const cls = size === "xl" ? "h-[180px] w-full text-4xl" : size === "md" ? "h-[72px] w-[72px] text-xl" : "h-14 w-14 text-lg";
  return (
    <div className={`grid flex-none place-items-center bg-[#ddd] font-bold text-[#888] ${cls}`}>{letter}</div>
  );
}

export function AdCard({ ad, featured }: { ad: ListingDoc; featured?: boolean }) {
  const href = `/ad/${ad.slug}/`;
  const letter = (ad.displayName || "?").slice(0, 1);
  const variant = ad.variant || "free";
  const isStar = variant === "star" || featured;
  const highlight = variant === "highlight" || variant === "flash";
  const superTop = variant === "supertop" || variant === "flash";
  const showPhoto = variant !== "free";

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
          className="absolute right-2 top-2 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
          style={{
            background:
              variant === "flash" ? "var(--sk-flash)" : variant === "star" ? "#c9a227" : "var(--sk-top)",
          }}
        >
          {variant === "supertop" ? "Super Top" : variant === "flash" ? "Available now" : variant === "star" ? "Star" : "TOP"}
        </span>
      ) : null}
      <div className={`flex gap-3 ${isStar ? "flex-col" : ""}`}>
        {showPhoto ? <Thumb letter={letter} size={isStar ? "xl" : superTop ? "md" : "sm"} /> : null}
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
          <p className="mt-2 text-[12px]" style={{ color: isStar ? "#bbb" : "#888" }}>
            {ad.age} years {ad.citySlug}
            {ad.place ? ` / ${ad.place}` : ""}
            {ad.verified ? " · Verified" : ""}
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
    <section className="mb-4">
      <h2 className="mb-2 text-[16px] font-bold">Discover our Star listings</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ads.map((ad) => (
          <AdCard key={ad.publicId} ad={ad} featured />
        ))}
      </div>
    </section>
  );
}
