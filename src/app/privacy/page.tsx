import { TrustLegalPage } from "@/components/new/TrustLegalPage";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";

const copy = TRUST.privacy;

export const metadata = pageMetadata({
  title: "Privacy Policy: what Tharkoo collects and why | Tharkoo",
  description: copy.description,
  path: "/privacy/",
});

export default function Page() {
  return <TrustLegalPage trustKey="privacy" />;
}
