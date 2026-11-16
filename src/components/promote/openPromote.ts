export const PROMOTE_EVENT = "tk-promote-open";

export type PromoteOptions = { listingId: string; title?: string; planId?: string };

/** H7.116: opens the Promote sheet for one live ad. planId pre-selects a plan (the success screen's "Get more views"). */
export function openPromote(options: PromoteOptions) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PromoteOptions>(PROMOTE_EVENT, { detail: options }));
}
