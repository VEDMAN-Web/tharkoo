import { cookies } from "next/headers";
import { Inbox } from "@/components/chat/Inbox";
import { Container } from "@/components/ui/Container";
import { DiscoverFeed } from "@/components/buyer/DiscoverFeed";
import { UserPanelShell } from "@/components/buyer/UserPanelShell";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary, loadPickers } from "@/server/notifications/summary";
import { newDesignOn } from "@/server/site-links/new-design";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Messages | Tharkoo",
  description: "Chats about your ads.",
  path: "/u/account/messages/",
  index: false,
});

export default async function Page() {
  if (await newDesignOn()) {
    const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
    const pickers = await loadPickers();
    return (
      <UserPanelShell active="chats" summary={summary}>
        <h1 className="t-h1" style={{ fontSize: 28 }}>Chats</h1>
        <div style={{ marginTop: 16 }}>
          <Inbox />
        </div>
        <div style={{ marginTop: 28 }}>
          <DiscoverFeed categories={pickers.categories} cities={pickers.cities} heading="More ads you may like" intro="Keep browsing while you wait for replies." />
        </div>
      </UserPanelShell>
    );
  }
  return (
    <Container className="py-8">
      <h1 className="t-h1">Messages</h1>
      <p className="t-body mt-2 text-muted">Chats from people interested in your ads. Phone numbers and emails are never shown here.</p>
      <div className="mt-6">
        <Inbox />
      </div>
    </Container>
  );
}
