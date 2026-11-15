import { cookies } from "next/headers";
import { ComingSoon } from "@/components/account/AccountTools";
import { NotificationsPanel } from "@/components/buyer/NotificationsPanel";
import { UserPanelShell } from "@/components/buyer/UserPanelShell";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadNotifications } from "@/server/notifications/feed";
import { loadPanelSummary } from "@/server/notifications/summary";
import { newDesignOn } from "@/server/site-links/new-design";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Notifications | Tharkoo",
  description: "Account messages will live here.",
  path: "/u/account/notifications/",
  index: false,
});

/** H7.6: real notifications behind the New design switch. The old design keeps its "Coming soon" page. */
export default async function Page() {
  if (!(await newDesignOn())) {
    return <ComingSoon title="Notifications" body="Account messages will live here." href="/u/account/dashboard/" label="Back to dashboard" />;
  }
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  const items = summary.signedIn ? await loadNotifications(summary.userId) : null;
  return (
    <UserPanelShell active="notifications" summary={summary}>
      <NotificationsPanel items={items} />
    </UserPanelShell>
  );
}
