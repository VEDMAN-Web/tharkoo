import { TrustLegalPage } from "@/components/new/TrustLegalPage";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";

const copy = TRUST.terms;

export const metadata = pageMetadata({
  title: "Terms of use for Tharkoo classifieds | Tharkoo",
  description: copy.description,
  path: "/terms/",
});

export default function Page() {
  return <TrustLegalPage trustKey="terms" />;
}
