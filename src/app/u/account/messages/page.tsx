import { Inbox } from "@/components/chat/Inbox";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Messages | Tharkoo",
  description: "Chats about your ads.",
  path: "/u/account/messages/",
  index: false,
});

export default function Page() {
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
