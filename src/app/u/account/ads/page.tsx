import { AdsList } from "@/components/vendor/VendorScreens";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Your ads | Tharkoo",
  description: "Listings on your Tharkoo account.",
  path: "/u/account/ads/",
  index: false,
});

export default function Page() {
  return <AdsList />;
}
