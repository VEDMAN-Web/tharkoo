import { Landmark } from "lucide-react";
import { PanelNotice } from "@/components/buyer/PanelNotice";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Bank transfer | Tharkoo",
  description: "Bank transfer is not available yet.",
  path: "/u/account/credits/bank/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="coins" next="/u/account/credits/" title="Log in to see your credits" body="Your credits and payments appear here after you log in.">
      <PanelNotice icon={Landmark} tk="bank-off" title="Bank transfer is not available" body="No bank payment provider is connected, so bank transfer is switched off. You can add credits on the credits page." href="/u/account/credits/" label="Open credits" />
    </PanelPage>
  );
}
