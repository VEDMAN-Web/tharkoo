import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Age check | Tharkoo",
  description: "Use the age confirmation on the site, or the identity check in your account.",
  path: "/u/age-verification/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Age check" body="Use the age confirmation on the site, or the identity check in your account." href="/u/account/kyc/" label="Identity check" />;
}
