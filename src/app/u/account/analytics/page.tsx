import { cookies } from "next/headers";
import { AnalyticsPanel } from "@/components/buyer/AnalyticsPanel";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";
import { SESSION_COOKIE } from "@/server/auth/http";
import { Types } from "mongoose";
import { realCountsFor } from "@/server/analytics/counts";
import { listOwnCards } from "@/server/listings/owner-cards";
import { sellerDashboard } from "@/server/listings/seller-dashboard";
import { loadPanelSummary } from "@/server/notifications/summary";
import { getPaths } from "@/server/urls/service";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Analytics | Tharkoo",
  description: "Views and clicks on your ads.",
  path: "/u/account/analytics/",
  index: false,
});

export default async function Page() {
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  const cards = summary.signedIn ? await listOwnCards(summary.userId, { page: 1, pageSize: 50 }) : null;
  const paths = await getPaths();
  // H14.3: the same real numbers as the dashboard: AdEvent and the real counters, never viewsSet or clicksSet.
  const counts = cards ? await realCountsFor(cards.items.flatMap((item) => (item.id ? [new Types.ObjectId(item.id)] : []))) : null;
  const week = cards && summary.signedIn ? await sellerDashboard(summary.userId) : null;
  const real = { byAd: Object.fromEntries(counts ?? []), week: { views: week?.views.total ?? 0, clicks: week?.clicks.total ?? 0 } };
  return (
    <PanelPage active="ads" next="/u/account/analytics/" title="Log in to see your analytics" body="Views and clicks for your ads appear here after you log in.">
      {cards ? <AnalyticsPanel cards={cards} real={real} paths={paths} /> : null}
    </PanelPage>
  );
}
