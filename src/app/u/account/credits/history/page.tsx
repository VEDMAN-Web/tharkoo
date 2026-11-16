import { WalletHistory } from "@/components/account/AccountTools";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Credit history | Tharkoo",
  description: "Credit transactions on your Tharkoo account.",
  path: "/u/account/credits/history/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="coins" next="/u/account/credits/history/" title="Log in to see your history" body="Purchases and spends show here after you log in.">
      <WalletHistory />
    </PanelPage>
  );
}
