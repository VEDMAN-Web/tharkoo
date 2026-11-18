import { cookies } from "next/headers";
import { Inbox } from "@/components/chat/Inbox";
import { Container } from "@/components/ui/Container";
import { FreshAds } from "@/components/buyer/FreshAds";
import { UserPanelShell } from "@/components/buyer/UserPanelShell";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary } from "@/server/notifications/summary";
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
    return (
      <UserPanelShell active="chats" summary={summary} below={<FreshAds title="More ads you may like" standardCards />}>
        <section aria-labelledby="chats-title" className="up-glass up-panel">
          <div className="up-panel-head">
            <div>
              <h1 id="chats-title" className="up-h2">Chats</h1>
              <p className="up-muted">Chats from people interested in your ads. Phone numbers and emails are never shown here.</p>
            </div>
          </div>
          <Inbox />
        </section>
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
