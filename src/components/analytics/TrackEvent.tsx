"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/ga";
import type { GaEventName } from "@/lib/analytics/ga";

/** H17.11: sends one event when the page shows (for example a search or an ad view). Only the allowed fields leave; see lib/analytics/ga.ts. */
export function TrackEvent({ name, params }: { name: Exclude<GaEventName, "page_view">; params?: Record<string, string | undefined> }) {
  const key = JSON.stringify(params ?? {});
  useEffect(() => {
    trackEvent(name, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, key]);
  return null;
}
