import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Ad | Tharkoo",
  description: "Open your ads list to see a real listing.",
  path: "/u/account/ads/in00001/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Ad" body="Open your ads list to see a real listing." href="/u/account/ads/" label="Your ads" />;
}
