"use client";

import type { ReactNode } from "react";
import type { ListingDoc } from "@/lib/models";
import { useUrlPaths } from "@/components/UrlPaths";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import { ListingRow } from "./ListingRow";
import { listingRowData, rowLabels } from "./listing-row-data";
import "./listing-grid.css";

const NO_NAMES = new Map<string, string>();

/** The card every ad list uses except Home (H14.1): the approved row, with the Home card's photo slider. */
export function ListingCard({ ad, order, texts }: { ad: ListingDoc; order: number; texts?: UiTextMap }) {
  const t = makeT(texts);
  const paths = useUrlPaths();
  const labels = {
    online: t("home.ads.online"),
    watermark: t("home.ads.watermark"),
    photoPrev: t("home.ads.photoPrev"),
    photoNext: t("home.ads.photoNext"),
    chat: t("home.ads.chat"),
    viewAd: t("home.ads.viewAd"),
    age: t("home.ads.age"),
    row: rowLabels(t),
  };
  return <ListingRow ad={listingRowData(ad, NO_NAMES, paths, t("card.fallbackTitle"))} labels={labels} order={order} />;
}

export function ListingGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="tkn-grid tk-rows" data-tk="listing-grid" aria-label={label}>
      {children}
    </ul>
  );
}
