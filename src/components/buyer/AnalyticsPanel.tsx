import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { displayTitle } from "@/lib/format";
import { draftPath, ownAdStatus } from "@/lib/ui/ad-status";
import { adPath, type UrlPaths } from "@/lib/urls";
import type { listOwnCards } from "@/server/listings/owner-cards";
import { EmptyIcon } from "./UserPanelShell";

type Cards = Awaited<ReturnType<typeof listOwnCards>>;

export function AnalyticsPanel({ cards, paths }: { cards: Cards; paths: UrlPaths }) {
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
        <div className="up-stat"><span className="up-stat-num" data-tk="total-views">{cards.totals.views}</span><span className="up-stat-label">Views</span></div>
        <div className="up-stat"><span className="up-stat-num" data-tk="total-clicks">{cards.totals.clicks}</span><span className="up-stat-label">Clicks</span></div>
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
                  <Link href={item.slug ? adPath(paths, item.slug) : draftPath(item.id ?? "")} prefetch={false} className="up-row-link" data-tk="analytics-link">
                    {displayTitle(item.title || "") || "Untitled ad"}
                  </Link>
                </td>
                <td>{ownAdStatus(item.status, item.expiresAt).label}</td>
                <td>{item.shown.views}</td>
                <td>{item.shown.clicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
