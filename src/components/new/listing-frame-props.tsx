import type { ReactNode } from "react";
import type { ShellImage } from "@/server/site-links/shell-config-rules";
import { bandStyleFor } from "./band-image";
import { ListingHead } from "./ListingHead";
import { ListingSearchForm } from "./ListingSearchForm";
import { ListingFilterPanel } from "./ListingFilterPanel";
import { activeFilterCount, filterRows, type FilterField, type SelectedFilters } from "./listing-filters";

/**
 * H7.4b: builds the parts of the listing frame (title band, search form, filter panel) for a category or city page.
 * The city page and the category page share it, so both draw the same frame. Server-side only: it returns elements.
 */
export function listingFrameProps(input: {
  crumbs: { name: string; path: string }[];
  h1: string;
  intro?: string;
  image: ShellImage | null;
  categorySlug: string;
  citySlug?: string;
  searchAction: string;
  searchPlaceholder: string;
  chips: ReactNode;
  fields: FilterField[] | undefined;
  selected: SelectedFilters;
  verified: boolean;
  photos: boolean;
  /** The listing URL without filters: the form posts here and "Clear all" goes here. */
  panelPath: string;
  verifiedLabel: string;
  photosLabel: string;
}) {
  const rows = filterRows(input.fields, input.selected);
  const activeCount = activeFilterCount(rows, { verified: input.verified, photos: input.photos });
  return {
    bandStyle: bandStyleFor(input.image),
    head: <ListingHead crumbs={input.crumbs} h1={input.h1} intro={input.intro} />,
    chips: input.chips,
    searchForm: (
      <ListingSearchForm
        action={input.searchAction}
        categorySlug={input.categorySlug}
        citySlug={input.citySlug}
        placeholder={input.searchPlaceholder}
      />
    ),
    filters: (
      <ListingFilterPanel
        action={input.panelPath}
        rows={rows}
        activeCount={activeCount}
        verified={input.verified}
        photos={input.photos}
        clearHref={input.panelPath}
        verifiedLabel={input.verifiedLabel}
        photosLabel={input.photosLabel}
      />
    ),
    activeCount,
  };
}
