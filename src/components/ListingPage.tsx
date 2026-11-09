import Link from "next/link";
import { AdCard, StarStrip } from "./AdCard";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import type { ListingDoc } from "@/lib/models";

export function ListingPageView({
  h1,
  h2,
  intro,
  footer,
  crumbs,
  path,
  stars,
  items,
  page,
  pages,
  total,
  siblingLinks,
  emptyNearby,
  photos,
  verified,
}: {
  h1: string;
  h2?: string;
  intro?: string;
  footer?: string;
  crumbs: { name: string; path: string }[];
  path: string;
  stars: ListingDoc[];
  items: ListingDoc[];
  page: number;
  pages: number;
  total: number;
  noindex?: boolean;
  siblingLinks: { href: string; label: string }[];
  emptyNearby: { href: string; label: string }[];
  photos?: boolean;
  verified?: boolean;
}) {
  const action = path.split("?")[0];
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(crumbs), {
        "@context": "https://schema.org",
        "@type": "ItemList",
        numberOfItems: total,
        url: canonical(path.split("?")[0]),
        itemListElement: items.map((ad, i) => ({
          "@type": "ListItem",
          position: (page - 1) * 25 + i + 1,
          url: canonical(`/ad/${ad.slug}/`),
          name: ad.title,
        })),
      }]} />
      <nav className="mb-2 text-[12px] text-[#888]">
        {crumbs.map((c, i) => (
          <span key={c.path}>
            {i > 0 ? " › " : null}
            <Link href={c.path}>{c.name}</Link>
          </span>
        ))}
      </nav>
      <h1 className="text-[28px] font-normal leading-tight text-[#222]">{h1}</h1>
      {h2 ? <h2 className="mt-1 text-[16px] font-normal text-[#555]">{h2}</h2> : null}
      {intro ? <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[#555]">{intro}</p> : null}
      {siblingLinks.length ? (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
          {siblingLinks.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
      <form className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]" action={action}>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="photos" value="1" defaultChecked={photos} /> With photos only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="verified" value="1" defaultChecked={verified} /> Verified only
        </label>
        <button className="text-[var(--sk-link)]" type="submit">Apply</button>
      </form>
      <p className="mt-2 text-[12px] text-[#888]">{total} ads</p>
      <div className="ad-list mt-4 overflow-hidden">
        <StarStrip ads={stars} />
        {items.length ? (
          items.map((ad) => <AdCard key={ad.publicId} ad={ad} />)
        ) : (
          <div className="p-8 text-sm">
            <p>No live ads on this page yet.</p>
            {emptyNearby.length ? (
              <p className="mt-2">
                Try nearby:{" "}
                {emptyNearby.map((n) => (
                  <Link key={n.href} href={n.href} className="mr-2">
                    {n.label}
                  </Link>
                ))}
              </p>
            ) : null}
          </div>
        )}
      </div>
      {pages > 1 ? (
        <nav className="mt-4 flex gap-1 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 12).map((n) => (
            <Link
              key={n}
              href={`${action}${n === 1 ? "" : `?page=${n}`}`}
              className={`min-w-8 px-2 py-1 text-center ${n === page ? "bg-[var(--sk-blue)] text-white" : "bg-white"}`}
            >
              {n}
            </Link>
          ))}
        </nav>
      ) : null}
      {footer ? <p className="mt-8 text-[13px] text-[#555]">{footer}</p> : null}
    </>
  );
}
