import { cookies } from "next/headers";
import { NewTicketForm } from "@/components/support/NewTicketForm";
import { SignedOutPanel, UserPanelShell } from "@/components/buyer/UserPanelShell";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary } from "@/server/notifications/summary";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "New support ticket | Tharkoo",
  description: "Open a support ticket.",
  path: "/u/account/support/new/",
  index: false,
});

export default async function Page() {
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  if (!summary.signedIn) {
    return (
      <UserPanelShell active="support" summary={summary}>
        <SignedOutPanel next="/u/account/support/new/" title="Log in to open a ticket" body="Support tickets are kept on your account." />
      </UserPanelShell>
    );
  }
  return (
    <UserPanelShell active="support" summary={summary}>
      <section aria-labelledby="new-ticket-title" className="up-glass up-panel">
        <h1 id="new-ticket-title" className="up-h2">New ticket</h1>
        <p className="up-muted">Tell us what happened. Include as much detail as you can. You can open up to 5 tickets an hour.</p>
        <div style={{ marginTop: 16 }}>
          <NewTicketForm />
        </div>
      </section>
    </UserPanelShell>
  );
}
