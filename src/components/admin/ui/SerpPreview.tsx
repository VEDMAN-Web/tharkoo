"use client";

import { useMemo } from "react";

export const TITLE_DESKTOP_PX = 580;
export const TITLE_MOBILE_PX = 920; // two lines of about 460 px
export const DESC_DESKTOP_PX = 920;
const TITLE_FONT = "20px Arial";
const DESC_FONT = "14px Arial";

type Measure = (text: string) => number;

/** Cuts `text` so it fits in `maxPx`, ending with an ellipsis when it was shortened. */
export function truncateToWidth(text: string, maxPx: number, measure: Measure): string {
  if (measure(text) <= maxPx) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(`${text.slice(0, mid).trimEnd()}…`) <= maxPx) low = mid;
    else high = mid - 1;
  }
  return `${text.slice(0, low).trimEnd()}…`;
}

/** Real text measuring needs a canvas; without one (server, tests) fall back to about 0.52 em per character. */
export function makeMeasure(font: string): Measure {
  const size = Number.parseFloat(font) || 16;
  const fallback: Measure = (text) => text.length * size * 0.52;
  if (typeof document === "undefined") return fallback;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return fallback;
  ctx.font = font;
  return (text) => ctx.measureText(text).width;
}

export function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  // Canvas widths differ from the server's estimate, so the cut text is allowed to differ after hydration.
  const { titleM, descM } = useMemo(() => ({ titleM: makeMeasure(TITLE_FONT), descM: makeMeasure(DESC_FONT) }), []);
  const desktopTitle = truncateToWidth(title, TITLE_DESKTOP_PX, titleM);
  const mobileTitle = truncateToWidth(title, TITLE_MOBILE_PX, titleM);
  const desc = truncateToWidth(description, DESC_DESKTOP_PX, descM);
  return (
    <div className="adm-serp">
      <div>
        <p className="adm-serp-meta">Google, desktop</p>
        <div className="adm-serp-card">
          <p className="adm-serp-url">{url}</p>
          <p className="adm-serp-title" suppressHydrationWarning>{desktopTitle || "Page title"}</p>
          <p className="adm-serp-desc" suppressHydrationWarning>{desc || "Description"}</p>
        </div>
      </div>
      <div>
        <p className="adm-serp-meta">Google, mobile</p>
        <div className="adm-serp-card is-mobile">
          <p className="adm-serp-url">{url}</p>
          <p className="adm-serp-title" suppressHydrationWarning>{mobileTitle || "Page title"}</p>
          <p className="adm-serp-desc" suppressHydrationWarning>{desc || "Description"}</p>
        </div>
      </div>
      {desktopTitle !== title ? <p className="adm-field-error">The title is cut off on desktop ({TITLE_DESKTOP_PX} px).</p> : null}
    </div>
  );
}
