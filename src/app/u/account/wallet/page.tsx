import { CoinWallet } from "@/components/wallet/CoinWallet";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Wallet | Tharkoo",
  description: "Your Tharkoo credit balance, credit packs, earnings and withdrawals.",
  path: "/u/account/wallet/",
  index: false,
});

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return (
    <div className="tk-container" style={{ paddingLeft: 16, paddingRight: 16, maxWidth: 720, margin: "0 auto" }}>
      <CoinWallet initialTab={tab === "earnings" ? "earnings" : "buy"} />
    </div>
  );
}
