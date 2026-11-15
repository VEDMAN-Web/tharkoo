import type { CSSProperties, ReactNode } from "react";
import { bandStyleFor, type BandPhoto } from "./band-image";
import { ListingHead } from "./ListingHead";
import { ListingSearchForm } from "./ListingSearchForm";
import type { ListingLabels } from "./listing-filters";
import "./listing-page.css";

/**
 * H7.32: the New design title band (the #185 split: glass panel left, photo right; phone photo on top) for pages that
 * have no filter panel. Breadcrumb, H1, intro and the search box scoped to the page. Server-rendered.
 */
export function ListingBand({
  crumbs,
  h1,
  intro,
  photo,
  categorySlug,
  citySlug,
  searchAction,
  placeholder,
  labels,
}: {
  crumbs: { name: string; path: string }[];
  h1: string;
  intro?: string;
  photo: BandPhoto | null;
  categorySlug?: string;
  citySlug?: string;
  searchAction: string;
  placeholder: string;
  labels: ListingLabels;
}) {
  const style = bandStyleFor(photo);
  const hasPhoto = Boolean(style["--band-desk"] || style["--band-phone"]);
  return (
    <section className="tkn-ls-band" data-tk="listing-band" data-photo={hasPhoto ? "true" : "false"} style={style as CSSProperties}>
      <ListingHead crumbs={crumbs} h1={h1} intro={intro} labels={labels} />
      <div className="tkn-ls-searchrow">
        <ListingSearchForm action={searchAction} categorySlug={categorySlug ?? ""} citySlug={citySlug} placeholder={placeholder} labels={labels} />
      </div>
    </section>
  );
}

/** A New design page with the title band above its body. The body is drawn by the page. */
export function NewListingPage({ band, children, tk }: { band: React.ComponentProps<typeof ListingBand>; children: ReactNode; tk?: string }) {
  return (
    <div className="tkn-ls tkn-lp" data-tk={tk}>
      <ListingBand {...band} />
      <div className="tkn-lp-body">{children}</div>
    </div>
  );
}
