import { cookies } from "next/headers";
import { CoinsPanel } from "@/components/buyer/CoinsPanel";
import { SESSION_COOKIE } from "@/server/auth/http";
import { readMoneySettings } from "@/server/billing/money-settings";
import { loadPacks, loadPanelSummary } from "@/server/notifications/summary";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Credits and payments | Tharkoo",
  description: "Your Tharkoo credit balance.",
  path: "/u/account/credits/",
  index: false,
});

export default async function Page() {
  const [summary, packs, money] = await Promise.all([loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value), loadPacks(), readMoneySettings()]);
  return <CoinsPanel summary={summary} packs={packs} creditPriceInr={money.creditPriceInr} />;
}
