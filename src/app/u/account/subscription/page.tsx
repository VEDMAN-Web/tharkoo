import { Repeat } from "lucide-react";
import { PanelNotice } from "@/components/buyer/PanelNotice";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Subscription | Tharkoo",
  description: "Tharkoo has no subscription. You pay with credits.",
  path: "/u/account/subscription/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="coins" next="/u/account/subscription/" title="Log in to see your plan" body="Your plan and credits appear here after you log in.">
      <PanelNotice icon={Repeat} tk="no-subscription" title="No subscription" body="Tharkoo has no monthly plan. You pay for what you use with credits, and nothing renews by itself." href="/u/account/credits/" label="Open credits" />
    </PanelPage>
  );
}
