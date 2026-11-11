import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Analytics | Tharkoo",
  description: "Listing stats will live here.",
  path: "/u/account/analytics/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Analytics" body="Listing stats will live here." href="/u/account/ads/" label="View your ads" />;
}
