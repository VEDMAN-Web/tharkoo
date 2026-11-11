import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Photo check | Tharkoo",
  description: "Photo checks are coming soon.",
  path: "/u/account/media/verify/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Photo check" body="Photo checks are coming soon." href="/u/account/kyc/" label="Identity check" />;
}
