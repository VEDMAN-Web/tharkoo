import { TrustLegalPage } from "@/components/new/TrustLegalPage";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";

const copy = TRUST.safety;

export const metadata = pageMetadata({
  title: "Safety tips for meeting people on Tharkoo | Tharkoo",
  description: copy.description,
  path: "/safety/",
});

export default function Page() {
  return <TrustLegalPage trustKey="safety" />;
}
