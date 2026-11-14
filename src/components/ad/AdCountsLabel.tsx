"use client";

import { Eye, MousePointerClick } from "lucide-react";
import { formatIndianCount } from "./counts-format";
import type { ShownCounts } from "./adCountStore";

/** H6.17: "1,234 views" and "56 clicks", muted. Draws nothing until the numbers have loaded, so the card does not move. */
export function AdCountsLabel({ counts, className = "tk-ad-counts" }: { counts: ShownCounts | null; className?: string }) {
  if (!counts) return null;
  return (
    <span className={className} data-tk="ad-counts">
      <span className="tk-ad-count" data-tk="ad-views">
        <Eye size={13} aria-hidden />
        {formatIndianCount(counts.views)} views
      </span>
      <span className="tk-ad-count" data-tk="ad-clicks">
        <MousePointerClick size={13} aria-hidden />
        {formatIndianCount(counts.clicks)} clicks
      </span>
    </span>
  );
}
