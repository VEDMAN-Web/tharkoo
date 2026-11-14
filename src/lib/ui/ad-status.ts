/**
 * H6.19: the status label on each ad in the vendor panel ("Your ads").
 * Pure, so the same rule can be tested without a browser.
 */
export type OwnAdLabel = "Live" | "Ending soon" | "In review" | "Ended" | "Draft" | "Paused" | "Rejected";

export interface OwnAdStatus {
  label: OwnAdLabel;
  bg: string;
  fg: string;
}

/** An ad that ends within this many milliseconds shows "Ending soon". */
export const ENDING_SOON_MS = 3 * 24 * 60 * 60 * 1000;

const LOOK: Record<OwnAdLabel, { bg: string; fg: string }> = {
  Live: { bg: "#ECFDF5", fg: "#047857" },
  "Ending soon": { bg: "#FFF5E6", fg: "#92400E" },
  "In review": { bg: "#F5F0FF", fg: "#5B21B6" },
  Ended: { bg: "#F3F4F6", fg: "#374151" },
  Draft: { bg: "#F3F4F6", fg: "#374151" },
  Paused: { bg: "#FFF5E6", fg: "#92400E" },
  Rejected: { bg: "#FEF2F2", fg: "#991B1B" },
};

export function ownAdStatus(status: string | null | undefined, expiresAt: string | null | undefined, now: number = Date.now()): OwnAdStatus {
  const label = labelFor(status, expiresAt, now);
  return { label, ...LOOK[label] };
}

function labelFor(status: string | null | undefined, expiresAt: string | null | undefined, now: number): OwnAdLabel {
  switch (status) {
    case "active": {
      const ends = expiresAt ? Date.parse(expiresAt) : Number.NaN;
      return Number.isFinite(ends) && ends - now <= ENDING_SOON_MS ? "Ending soon" : "Live";
    }
    case "pending":
      return "In review";
    case "expired":
    case "archived":
    case "removed":
    case "deleted":
      return "Ended";
    case "paused":
      return "Paused";
    case "rejected":
      return "Rejected";
    default:
      return "Draft";
  }
}
