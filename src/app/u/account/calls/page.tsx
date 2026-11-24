import { cookies } from "next/headers";
import { SignedOutPanel, UserPanelShell } from "@/components/buyer/UserPanelShell";
import { CallsList } from "@/components/vendor/CallsList";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary } from "@/server/notifications/summary";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Video calls | Tharkoo",
  description: "Your video call requests and calls.",
  path: "/u/account/calls/",
  index: false,
});

export default async function Page() {
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <UserPanelShell active="calls" summary={summary}>
      {summary.signedIn ? (
        <section aria-labelledby="calls-heading" className="up-glass up-panel">
          <div className="up-panel-head">
            <h1 id="calls-heading" className="up-h2">Video calls</h1>
          </div>
          <CallsList />
        </section>
      ) : (
        <SignedOutPanel next="/u/account/calls/" title="Log in to see your video calls" body="Calls you asked for and requests on your ads show here." />
      )}
    </UserPanelShell>
  );
}
