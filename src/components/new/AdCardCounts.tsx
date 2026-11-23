"use client";

import { Eye, MousePointerClick } from "lucide-react";
import { useShownCounts } from "@/components/ad/adCountStore";
import { formatIndianCount } from "@/components/ad/counts-format";
import "./home-ads.css";

export type CountLabels = { views: string; viewOne: string; clicks: string; clickOne: string };

const DEFAULT_LABELS: CountLabels = { views: "{count} views", viewOne: "{count} view", clicks: "{count} clicks", clickOne: "{count} click" };

function say(count: number, one: string, many: string) {
  return (count === 1 ? one : many).replace("{count}", formatIndianCount(count));
}

/**
 * H19.1: the two small counts on every ad card: views (an eye) and clicks (a pointer), "0" when there are none.
 * The numbers are the shown counts of the ad (the same the ad owner sees); they load while the card is on the page.
 * `fixed` gives the numbers when the page already has them (My ads).
 */
export function AdCardCounts({ slug, labels = DEFAULT_LABELS, fixed }: { slug?: string; labels?: CountLabels; fixed?: { views: number; clicks: number } }) {
  const loaded = useShownCounts(slug ?? "");
  const counts = fixed ?? loaded;
  const views = counts?.views ?? 0;
  const clicks = counts?.clicks ?? 0;
  return (
    <span className="tkh-counts" data-tk="card-counts" data-ready={counts ? "true" : "false"}>
      <span className="tkh-count" data-tk="card-views" role="img" aria-label={say(views, labels.viewOne, labels.views)} title={say(views, labels.viewOne, labels.views)}>
        <Eye size={14} aria-hidden focusable="false" />
        <span aria-hidden>{formatIndianCount(views)}</span>
      </span>
      <span className="tkh-count" data-tk="card-clicks" role="img" aria-label={say(clicks, labels.clickOne, labels.clicks)} title={say(clicks, labels.clickOne, labels.clicks)}>
        <MousePointerClick size={14} aria-hidden focusable="false" />
        <span aria-hidden>{formatIndianCount(clicks)}</span>
      </span>
    </span>
  );
}
