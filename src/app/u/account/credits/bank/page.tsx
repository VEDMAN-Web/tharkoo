import { PanelComingSoon, PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Bank transfer | Tharkoo",
  description: "Bank transfers are coming soon. Buy credits in the wallet if a pack is listed.",
  path: "/u/account/credits/bank/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="coins" next="/u/account/credits/bank/" title="Log in to see bank transfer" body="Payment options show here after you log in.">
      <PanelComingSoon title="Bank transfer" body="Bank transfers will open soon. You can buy coins by card from the coins page when a pack is listed." href="/u/account/credits/" label="Open coins and payments" />
    </PanelPage>
  );
}
