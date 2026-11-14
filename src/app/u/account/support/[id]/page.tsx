import { TicketThread } from "@/components/support/TicketThread";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Support ticket | Tharkoo",
  description: "Read and reply to a support ticket.",
  path: "/u/account/support/",
  index: false,
});

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Container className="py-8">
      <TicketThread ticketId={id} />
    </Container>
  );
}
