import { cookies } from "next/headers";
import { AnalyticsPanel } from "@/components/buyer/AnalyticsPanel";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";
import { SESSION_COOKIE } from "@/server/auth/http";
import { listOwnCards } from "@/server/listings/owner-cards";
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
  return (
    <PanelPage active="ads" next="/u/account/analytics/" title="Log in to see your analytics" body="Views and clicks for your ads appear here after you log in.">
      {cards ? <AnalyticsPanel cards={cards} paths={paths} /> : null}
    </PanelPage>
  );
}
