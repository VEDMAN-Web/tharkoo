import { ShieldCheck } from "lucide-react";
import { PanelNotice } from "@/components/buyer/PanelNotice";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Age check | Tharkoo",
  description: "How Tharkoo checks that you are 18 or older.",
  path: "/u/age-verification/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="settings" next="/u/age-verification/" title="Log in to see your age check" body="Your age check appears here after you log in.">
      <PanelNotice icon={ShieldCheck} tk="age-check" title="Age check" body="You confirm you are 18 or older once, when you post your first ad. Some categories also ask for a quick ID check." href="/u/account/kyc/" label="Open the identity check" />
    </PanelPage>
  );
}
