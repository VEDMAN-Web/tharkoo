import { cookies } from "next/headers";
import { CoinsPanel } from "@/components/buyer/CoinsPanel";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPacks, loadPanelSummary } from "@/server/notifications/summary";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Coins and payments | Tharkoo",
  description: "Your Tharkoo coin balance.",
  path: "/u/account/credits/",
  index: false,
});

export default async function Page() {
  const [summary, packs] = await Promise.all([loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value), loadPacks()]);
  return <CoinsPanel summary={summary} packs={packs} />;
}
