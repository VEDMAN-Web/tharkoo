import { cookies } from "next/headers";
import { SignedOutPanel, UserPanelShell } from "@/components/buyer/UserPanelShell";
import { CoinWallet } from "@/components/wallet/CoinWallet";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary } from "@/server/notifications/summary";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Wallet | Tharkoo",
  description: "Your Tharkoo credit balance, credit packs, earnings and withdrawals.",
  path: "/u/account/wallet/",
  index: false,
});

/** H9.1: the Wallet sits in the account panel like every other account page, with the normal heading. Earnings show only with earnings. */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  if (!summary.signedIn) {
    return (
      <UserPanelShell active="coins" summary={summary}>
        <SignedOutPanel next="/u/account/wallet/" title="Log in to see your wallet" body="Your credit balance and earnings are kept on your account." />
      </UserPanelShell>
    );
  }
  return (
    <UserPanelShell active={tab === "earnings" ? "earnings" : "coins"} summary={summary}>
      <section aria-labelledby="wallet-heading" className="up-glass up-panel">
        <div className="up-panel-head">
          <h1 id="wallet-heading" className="up-h2">Wallet</h1>
        </div>
        <CoinWallet initialTab={tab === "earnings" ? "earnings" : "buy"} hasEarnings={summary.hasEarnings || summary.adCount > 0} />
      </section>
    </UserPanelShell>
  );
}
