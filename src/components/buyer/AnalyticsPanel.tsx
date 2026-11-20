import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { displayTitle } from "@/lib/format";
import { draftPath, ownAdStatus } from "@/lib/ui/ad-status";
import { adHref, type UrlPaths } from "@/lib/urls";
import type { listOwnCards } from "@/server/listings/owner-cards";
import { EmptyIcon } from "./UserPanelShell";

type Cards = Awaited<ReturnType<typeof listOwnCards>>;

/** H14.3: the real numbers (never the ones an admin sets for display): all-time per ad, and the last 7 days in total. */
export type RealNumbers = { byAd: Record<string, { views: number; clicks: number }>; week: { views: number; clicks: number } };

export function AnalyticsPanel({ cards, real, paths }: { cards: Cards; real: RealNumbers; paths: UrlPaths }) {
  const all = Object.values(real.byAd);
  const totalViews = all.reduce((sum, row) => sum + row.views, 0);
  const totalClicks = all.reduce((sum, row) => sum + row.clicks, 0);
  if (cards.total === 0) {
    return (
      <section aria-labelledby="analytics-title" className="up-glass up-panel up-empty" data-tk="analytics-empty">
        <EmptyIcon icon={BarChart3} />
        <h1 id="analytics-title" className="up-empty-title">Analytics</h1>
        <p className="up-empty-body">Views and clicks for your ads show here once you post one.</p>
        <Link href="/u/post-insert/" className="up-btn">Post an ad</Link>
      </section>
    );
  }
  return (
    <section aria-labelledby="analytics-title" className="up-glass up-panel up-stack" data-tk="analytics">
      <div>
        <h1 id="analytics-title" className="up-h2">Analytics</h1>
        <p className="up-muted">Views and clicks on your ads. Your own visits are not counted.</p>
      </div>
      <div className="up-stats">
        <div className="up-stat"><span className="up-stat-num">{cards.counts.live}</span><span className="up-stat-label">Live ads</span></div>
        <div className="up-stat"><span className="up-stat-num" data-tk="total-views">{totalViews}</span><span className="up-stat-label">Views, all time</span></div>
        <div className="up-stat"><span className="up-stat-num" data-tk="total-clicks">{totalClicks}</span><span className="up-stat-label">Clicks, all time</span></div>
        <div className="up-stat"><span className="up-stat-num" data-tk="week-views">{real.week.views}</span><span className="up-stat-label">Views, last 7 days</span></div>
        <div className="up-stat"><span className="up-stat-num" data-tk="week-clicks">{real.week.clicks}</span><span className="up-stat-label">Clicks, last 7 days</span></div>
      </div>
      <div className="up-table-wrap">
        <table className="up-table">
          <thead>
            <tr><th scope="col">Ad</th><th scope="col">Status</th><th scope="col">Views</th><th scope="col">Clicks</th></tr>
          </thead>
          <tbody>
            {cards.items.map((item) => (
              <tr key={item.id} data-tk="analytics-row">
                <td>
                  <Link href={item.slug ? adHref(paths, { slug: item.slug, address: item.card?.address }) : draftPath(item.id ?? "")} prefetch={false} className="up-row-link" data-tk="analytics-link">
                    {displayTitle(item.title || "") || "Untitled ad"}
                  </Link>
                </td>
                <td>{ownAdStatus(item.status, item.expiresAt).label}</td>
                <td data-tk="row-views">{real.byAd[item.id ?? ""]?.views ?? 0}</td>
                <td data-tk="row-clicks">{real.byAd[item.id ?? ""]?.clicks ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
