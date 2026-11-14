import { NewTicketForm } from "@/components/support/NewTicketForm";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "New support ticket | Tharkoo",
  description: "Open a support ticket.",
  path: "/u/account/support/new/",
  index: false,
});

export default function Page() {
  return (
    <Container className="py-8">
      <h1 className="t-h1">New ticket</h1>
      <p className="t-body mt-2 text-muted">Tell us what happened. Include as much detail as you can. You can open up to 5 tickets an hour.</p>
      <div className="mt-6">
        <NewTicketForm />
      </div>
    </Container>
  );
}
