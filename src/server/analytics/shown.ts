import type { AdCounterDoc } from "@/server/models/ad-event";

export interface ShownCounts {
  views: number;
  clicks: number;
}

/** Pure: the admin's set number plus every real count after the moment it was set. Never below 0. */
export function shownValue(set: number, real: number, realAtSet: number): number {
  return Math.max(0, set + (real - realAtSet));
}

export function shownFrom(counter: Partial<AdCounterDoc> | null | undefined): ShownCounts {
  return {
    views: shownValue(counter?.viewsSet ?? 0, counter?.realViews ?? 0, counter?.viewsRealAtSet ?? 0),
    clicks: shownValue(counter?.clicksSet ?? 0, counter?.realClicks ?? 0, counter?.clicksRealAtSet ?? 0),
  };
}
