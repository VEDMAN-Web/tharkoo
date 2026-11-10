import { Sparkles, Star } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";
import { SaveButton } from "./SaveButton";
import { SmartImage } from "./SmartImage";
import { ContactButtons } from "../ContactButtons";

function fresh(ad: ListingDoc) {
  const variant = ad.variant || "free";
  if (variant !== "free") return false;
  const raw = ad.publishedAt || ad.createdAt;
  if (!raw) return false;
  return Date.now() - new Date(raw).getTime() < 48 * 60 * 60 * 1000;
}

export function AdCard({ ad, featured, priority }: { ad: ListingDoc; featured?: boolean; priority?: boolean }) {
  const variant = featured ? "star" : ad.variant || "free";
  const title = displayTitle(ad.title) || "Listing";
  const href = `/ad/${ad.slug}/`;
  const superTop = variant === "supertop" || variant === "flash";
  const place = ad.place || prettyPlace(ad.citySlug);
  const when = timeAgo(ad.publishedAt || ad.createdAt || ad.lastBumpedAt);
  const photo = ad.photos?.[0];
  const wide = superTop ? "w-36 md:w-60" : "w-36 md:w-[200px]";

  const inner = (
    <article
      className={cn(
        "relative flex min-w-0 overflow-hidden rounded-lg border border-line bg-surface shadow-sm",
        variant === "highlight" && "border-[color:var(--gold-line)] bg-[linear-gradient(180deg,var(--gold-soft),transparent_60%)]",
        variant === "top" && "border-[color:var(--gold-line)]",
        variant === "star" && "border-[color:var(--gold-line)] bg-[linear-gradient(135deg,#1c1710,#16161C)]",
      )}
    >
      <div className={cn("relative shrink-0", wide)}>
        <SmartImage
          src={photo}
          alt={`${title}, photo 1 of ${Math.max(ad.photos?.length || 1, 1)}`}
          seed={ad.slug || title}
          category={ad.categorySlug}
          width={superTop ? 240 : 200}
          height={superTop ? 300 : 250}
          priority={priority}
          sizes="(min-width: 768px) 240px, 144px"
          className="h-full"
        />
        <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
          {fresh(ad) ? <Badge tone="new">New</Badge> : null}
          {variant === "highlight" ? <Badge tone="highlight">Highlight</Badge> : null}
          {variant === "top" ? <Badge tone="top">Top</Badge> : null}
          {superTop ? (
            <Badge tone="supertop">
              <Sparkles size={12} aria-hidden /> Super Top
            </Badge>
          ) : null}
          {variant === "flash" ? <Badge tone="live">Available now</Badge> : null}
          {variant === "star" ? (
            <Badge tone="star">
              <Star size={12} aria-hidden /> Star
            </Badge>
          ) : null}
        </div>
        <div className="absolute right-2 top-2 z-10">
          <SaveButton
            item={{
              id: ad.publicId || ad.slug || title,
              slug: ad.slug || "",
              title,
              photo,
              place,
              at: 0,
            }}
            label="Save"
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <h3 className="t-h3 line-clamp-2">
          <a href={href} className="card-stretch">
            {title}
          </a>
        </h3>
        <p className="t-small text-muted">
          {prettyPlace(ad.categorySlug)}
          {place ? ` · ${place}` : ""}
          {when ? ` · ${when}` : ""}
          {ad.verified ? " · Verified" : ""}
        </p>
        {ad.description ? <p className="t-small hidden text-muted md:line-clamp-2">{ad.description}</p> : null}
        {superTop ? (
          <div className="relative z-10 mt-auto">
            <ContactButtons listingSlug={ad.slug} revealOnly />
          </div>
        ) : null}
      </div>
    </article>
  );

  if (!superTop) return inner;
  return (
    <div className="rounded-[18px] p-[1.5px] shadow-[var(--sh-gold)]" style={{ background: "var(--grad-gold)" }}>
      {inner}
    </div>
  );
}

export function StarStrip({ ads }: { ads: ListingDoc[] }) {
  if (!ads.length) return null;
  return (
    <section className="py-6" aria-label="Star picks">
      <h2 className="t-h2 mb-4">Star picks</h2>
      <div className="flex gap-3 overflow-x-auto lg:grid lg:grid-cols-3 lg:overflow-visible">
        {ads.map((ad) => (
          <div key={ad.slug || ad.publicId} className="w-[280px] shrink-0 lg:w-auto">
            <AdCard ad={ad} featured />
          </div>
        ))}
      </div>
    </section>
  );
}
