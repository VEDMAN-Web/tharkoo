import { CoinWallet } from "@/components/wallet/CoinWallet";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Wallet | Tharkoo",
  description: "Your Tharkoo coin balance, coin packs, vendor earnings and withdrawals.",
  path: "/u/account/wallet/",
  index: false,
});

export default function Page() {
  return (
    <div className="tk-container" style={{ paddingLeft: 16, paddingRight: 16, maxWidth: 720, margin: "0 auto" }}>
      <CoinWallet />
    </div>
  );
}
