"use client";

import { useEffect } from "react";
import { recordAdView } from "@/components/ad/adCountStore";

/** Opening the ad page counts a view (once per visitor, server side). The numbers are not shown to visitors. Preview pages are not counted. */
export function AdCountsBar({ slug }: { slug: string }) {
  useEffect(() => {
    recordAdView(slug);
  }, [slug]);
  return null;
}
