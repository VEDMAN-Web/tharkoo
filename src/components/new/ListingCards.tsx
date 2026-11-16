"use client";

import type { ReactNode } from "react";
import type { ListingDoc } from "@/lib/models";
import { useUrlPaths } from "@/components/UrlPaths";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import { HomeAdCard } from "./HomeAdCard";
import { homeAdCardData } from "./home-ad-data";
import "./listing-grid.css";

const NO_NAMES = new Map<string, string>();

/** The card every listing page uses: the Home ad card, with its auto-swipe, in the grid next to the filter column. */
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
  };
  return <HomeAdCard ad={homeAdCardData(ad, NO_NAMES, paths, t("card.fallbackTitle"))} labels={labels} order={order} />;
}

export function ListingGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="tkn-grid" data-tk="listing-grid" aria-label={label}>
      {children}
    </ul>
  );
}
