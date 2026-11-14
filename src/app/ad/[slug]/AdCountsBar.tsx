"use client";

import { useEffect } from "react";
import { holdAdCounts, recordAdView, useShownCounts } from "@/components/ad/adCountStore";
import { AdCountsLabel } from "@/components/ad/AdCountsLabel";

/**
 * H6.17: opening the ad page counts a view (once per visitor, server side) and shows the ad's views and clicks.
 * Preview pages are not counted.
 */
export function AdCountsBar({ slug }: { slug: string }) {
  useEffect(() => {
    recordAdView(slug);
    return holdAdCounts(slug);
  }, [slug]);
  const counts = useShownCounts(slug);
  return (
    <div className="tk-ad-counts-bar">
      <AdCountsLabel counts={counts} className="tk-ad-counts" />
    </div>
  );
}
