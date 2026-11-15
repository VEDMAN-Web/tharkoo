import { TrustLegalPage } from "@/components/new/TrustLegalPage";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";

const copy = TRUST.cookies;

export const metadata = pageMetadata({
  title: "Cookie policy: what Tharkoo stores and why | Tharkoo",
  description: copy.description,
  path: "/cookies/",
});

export default function Page() {
  return <TrustLegalPage trustKey="cookies" />;
}
