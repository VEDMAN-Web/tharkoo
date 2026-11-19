import Link from "next/link";
import { makeT } from "@/lib/ui/text";
import { TourInbox } from "@/components/vendor/TourInbox";
import type { listOwnCards } from "@/server/listings/owner-cards";
import { MyAdsList } from "./MyAdsList";

/** H9.2: the top of the account home for an advertiser: "Your ads" in numbers and ONE next step, then the ads and the live video tours. */

type Ads = Awaited<ReturnType<typeof listOwnCards>>;

const t = makeT();
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export type SellerLine = { lead: string; action: string; href: string };

/** The one next step. An ad that is about to end comes first (Renew); otherwise post an ad. Pure, so a test can read it. */
export function sellerLine(counts: { live: number; review: number; draft: number; endingSoon: number }, views: number): SellerLine {
  const { live, review, draft, endingSoon } = counts;
  if (endingSoon > 0) return { lead: `${endingSoon} ${plural(endingSoon, "ad ends", "ads end")} soon. Renew to keep ${plural(endingSoon, "it", "them")} showing.`, action: "Renew", href: "/u/account/ads/" };
  if (live > 0) return { lead: `${live} live now · ${views} ${plural(views, "view", "views")} in total`, action: "Post an ad", href: "/u/post-insert/" };
  if (review > 0) return { lead: t("panel.home.lead.review"), action: "Post an ad", href: "/u/post-insert/" };
  if (draft > 0) return { lead: t("panel.home.lead.draft"), action: "Post an ad", href: "/u/post-insert/" };
  return { lead: "You have no ads yet.", action: "Post an ad", href: "/u/post-insert/" };
}

export function SellerHomeAds({ name, ads }: { name: string; ads: Ads | null }) {
  const counts = { live: ads?.counts.live ?? 0, review: ads?.counts.review ?? 0, draft: ads?.counts.draft ?? 0, endingSoon: ads?.counts.endingSoon ?? 0 };
  const line = sellerLine(counts, ads?.totals.views ?? 0);
  return (
    <>
      <section className="up-hero" aria-labelledby="panel-hero" data-tk="seller-home">
        <p className="up-eyebrow">{`Hello ${name}`}</p>
        <h1 id="panel-hero" className="up-h1">Your ads</h1>
        <p className="up-lead" data-tk="seller-lead">{line.lead}</p>
        <div className="up-stats up-stats-3" style={{ marginTop: 16 }} data-tk="seller-stats">
          <div className="up-stat"><span className="up-stat-num">{counts.live}</span><span className="up-stat-label">Live</span></div>
          <div className="up-stat"><span className="up-stat-num">{counts.review}</span><span className="up-stat-label">In review</span></div>
          <div className="up-stat"><span className="up-stat-num">{counts.endingSoon}</span><span className="up-stat-label">Ending soon</span></div>
        </div>
        <div className="up-promo-row" style={{ marginTop: 16 }}>
          <Link href={line.href} className="up-btn" data-tk="seller-action">{line.action}</Link>
        </div>
      </section>
      <section aria-labelledby="my-ads-heading" className="up-glass up-panel" data-tk="seller-ads">
        <div className="up-panel-head">
          <h2 id="my-ads-heading" className="up-h2">My ads</h2>
          {ads && ads.counts.all > 0 ? <Link href="/u/account/ads/" className="up-link">{`See all ${ads.counts.all}`}</Link> : null}
        </div>
        {ads && ads.items.length > 0 ? <MyAdsList items={ads.items} /> : <p className="up-muted">Your ads show here once you post one.</p>}
        <TourInbox />
      </section>
    </>
  );
}
