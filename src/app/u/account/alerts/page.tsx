import { cookies } from "next/headers";
import { ComingSoon } from "@/components/account/AccountTools";
import { AlertsPanel } from "@/components/buyer/AlertsPanel";
import { SignedOutPanel, UserPanelShell } from "@/components/buyer/UserPanelShell";
import { listSavedSearches } from "@/server/alerts/saved-searches";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary, loadPickers } from "@/server/notifications/summary";
import { newDesignOn } from "@/server/site-links/new-design";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Alerts | Tharkoo",
  description: "Saved searches will live here.",
  path: "/u/account/alerts/",
  index: false,
});

/** H7.6: real saved-search alerts behind the New design switch. The old design keeps its "Coming soon" page. */
export default async function Page() {
  if (!(await newDesignOn())) {
    return <ComingSoon title="Alerts" body="Saved searches will live here." href="/search/" label="Search listings" />;
  }
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  if (!summary.signedIn) {
    return (
      <UserPanelShell active="alerts" summary={summary}>
        <SignedOutPanel next="/u/account/alerts/" title="Log in to manage alerts" body="Saved search alerts are kept on your account." />
      </UserPanelShell>
    );
  }
  const [rows, pickers] = await Promise.all([listSavedSearches(summary.userId), loadPickers()]);
  return (
    <UserPanelShell active="alerts" summary={summary}>
      <AlertsPanel rows={rows} email={summary.email} categories={pickers.categories} cities={pickers.cities} />
    </UserPanelShell>
  );
}
