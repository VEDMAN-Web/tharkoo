import { KycStatus } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Identity check | Tharkoo",
  description: "Your Tharkoo identity check status.",
  path: "/u/account/kyc/",
  index: false,
});

export default function Page() {
  return <KycStatus />;
}