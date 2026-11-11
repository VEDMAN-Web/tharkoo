import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Delete account | Tharkoo",
  description: "Account deletion from this page is coming soon. Write to support if you need it now.",
  path: "/u/account/delete/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Delete account" body="Account deletion from this page is coming soon. Write to support if you need it now." href="/contact/" label="Contact" />;
}
