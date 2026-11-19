"use client";

import { useEffect } from "react";
import { recordAdView } from "@/components/ad/adCountStore";
import { TrackEvent } from "@/components/analytics/TrackEvent";

/**
 * Opening the ad page counts a view (once per visitor, server side). The numbers are not shown to visitors. Preview pages are not counted.
 * H17.11: a real ad (not a sample ad) also sends the analytics event ad_view with its category and city, nothing else.
 */
export function AdCountsBar({ slug, category, city, sample = false }: { slug: string; category?: string; city?: string; sample?: boolean }) {
  useEffect(() => {
    recordAdView(slug);
  }, [slug]);
  return sample ? null : <TrackEvent name="ad_view" params={{ category, city }} />;
}
