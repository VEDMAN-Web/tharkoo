import Link from "next/link";
import type { ListingDoc } from "@/lib/models";

function Avatar({ letter, large }: { letter: string; large?: boolean }) {
  return (
    <div
      className={`grid place-items-center rounded bg-[var(--brand-primary)] font-semibold text-white ${large ? "h-40 w-full text-4xl" : "h-20 w-20 text-xl"}`}
    >
      {letter}
    </div>
  );
}

const LABELS: Record<string, string> = {
  top: "TOP",
  supertop: "Super Top",
  highlight: "Highlight",
  flash: "Available now",
  star: "Star",
};

export function AdCard({ ad, featured }: { ad: ListingDoc; featured?: boolean }) {
  const href = `/ad/${ad.slug}/`;
  const letter = (ad.displayName || "?").slice(0, 1);
  const isStar = ad.variant === "star" || featured;
  const highlight = ad.variant === "highlight" || ad.variant === "flash";
  const superTop = ad.variant === "supertop" || ad.variant === "flash";

  return (
    <article
      className={`relative overflow-hidden rounded-[var(--radius)] border bg-[var(--surface-card)] p-3 ${highlight ? "bg-[var(--bg-highlight)]" : ""} ${superTop ? "border-[3px] border-[var(--border-supertop)]" : "border-gray-200"} ${isStar ? "bg-[var(--card-star)] text-white" : ""} ${ad.subscriber ? "ring-2 ring-amber-400" : ""}`}
    >
      {LABELS[ad.variant || ""] ? (
        <span
          className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
          style={{
            background:
              ad.variant === "flash" ? "var(--badge-flash)" : ad.variant === "star" ? "#ca8a04" : "var(--label-top)",
          }}
        >
          {LABELS[ad.variant || ""]}
        </span>
      ) : null}
      <div className={`flex gap-3 ${isStar ? "flex-col" : ""}`}>
        {ad.photos?.length ? <Avatar letter={letter} large={isStar} /> : null}
        <div className="min-w-0 flex-1">
          <Link href={href} className={`block text-base font-semibold leading-snug ${isStar ? "text-white hover:text-amber-200" : ""}`}>
            {ad.title}
          </Link>
          <p className={`mt-1 line-clamp-3 text-sm ${isStar ? "text-white/80" : "text-[var(--text-secondary)]"}`}>
            {ad.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {(ad.chips || []).map((chip) => (
              <span key={chip} className={`rounded-full px-2 py-0.5 ${isStar ? "bg-white/15" : "bg-gray-100"}`}>
                {chip}
              </span>
            ))}
            {ad.verified ? (
              <span className="rounded-full bg-[var(--badge-verified)] px-2 py-0.5 text-white">Verified</span>
            ) : null}
          </div>
          {superTop ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {ad.phone ? (
                <a className="rounded bg-[var(--contact-call)] px-2 py-1 text-xs font-semibold text-white hover:text-white" href={`tel:${ad.phone}`}>
                  Call
                </a>
              ) : null}
              {ad.whatsapp ? (
                <a className="rounded bg-[var(--contact-wa)] px-2 py-1 text-xs font-semibold text-white hover:text-white" href={`https://wa.me/91${ad.whatsapp}`}>
                  WhatsApp
                </a>
              ) : null}
              {ad.telegram ? (
                <a className="rounded bg-[var(--contact-tg)] px-2 py-1 text-xs font-semibold text-white hover:text-white" href={`https://t.me/${ad.telegram}`}>
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
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold">Discover our Star listings</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ads.map((ad) => (
          <AdCard key={ad.publicId} ad={ad} featured />
        ))}
      </div>
    </section>
  );
}
