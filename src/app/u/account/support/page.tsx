import { SupportList } from "@/components/support/SupportList";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Support | Tharkoo",
  description: "Your support tickets.",
  path: "/u/account/support/",
  index: false,
});

export default function Page() {
  return (
    <Container className="py-8">
      <h1 className="t-h1">Support</h1>
      <p className="t-body mt-2 text-muted">Ask us about coins and payments, your ads, your account or a problem you found.</p>
      <div className="mt-6">
        <SupportList />
      </div>
    </Container>
  );
}
