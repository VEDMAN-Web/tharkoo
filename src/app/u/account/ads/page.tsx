import { AdsList } from "@/components/vendor/VendorScreens";
import { MyAdsPage } from "@/components/buyer/MyAdsPage";
import { pageMetadata } from "@/lib/ui/meta";
import { newDesignOn } from "@/server/site-links/new-design";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Your ads | Tharkoo",
  description: "Listings on your Tharkoo account.",
  path: "/u/account/ads/",
  index: false,
});

/** H7.73: with the New design on, My ads is its own page in the account panel. The old design keeps the list. */
export default async function Page() {
  if (!(await newDesignOn())) return <AdsList />;
  return <MyAdsPage />;
}
