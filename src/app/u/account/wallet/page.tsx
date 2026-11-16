import { CoinWallet } from "@/components/wallet/CoinWallet";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Wallet | Tharkoo",
  description: "Your Tharkoo coin balance, coin packs, vendor earnings and withdrawals.",
  path: "/u/account/wallet/",
  index: false,
});

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return (
    <PanelPage active="coins" next="/u/account/wallet/" title="Log in to see your wallet" body="Your coin balance and earnings load after you log in.">
      <CoinWallet initialTab={tab === "earnings" ? "earnings" : "buy"} />
    </PanelPage>
  );
}
