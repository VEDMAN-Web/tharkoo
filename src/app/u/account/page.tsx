import { Dashboard } from "@/components/vendor/VendorScreens";
import { PanelHomePage } from "@/components/buyer/PanelHomePage";
import { newDesignOn } from "@/server/site-links/new-design";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Your account | Tharkoo",
  description: "Your Tharkoo account.",
  path: "/u/account/",
  index: false,
});

export default async function Page() {
  if (await newDesignOn()) return <PanelHomePage />;
  return <Dashboard />;
}
