import { PanelComingSoon, PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Publishing packs | Tharkoo",
  description: "Packs will be listed here when they are on sale.",
  path: "/u/account/packs/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="coins" next="/u/account/packs/" title="Log in to see packs" body="Publishing packs show here after you log in.">
      <PanelComingSoon title="Publishing packs" body="Packs will be listed here when they are on sale." href="/u/account/credits/" label="Open coins and payments" />
    </PanelPage>
  );
}
