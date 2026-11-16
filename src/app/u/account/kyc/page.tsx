import { KycPanel } from "@/components/buyer/KycPanel";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Identity check | Tharkoo",
  description: "Your Tharkoo identity check status.",
  path: "/u/account/kyc/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="settings" next="/u/account/kyc/" title="Log in to see your identity check" body="Your check status appears here after you log in.">
      <KycPanel />
    </PanelPage>
  );
}
