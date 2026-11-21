import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { CoinsPanel } from "@/components/buyer/CoinsPanel";
import { PaymentNotice } from "@/components/recharge/PaymentNotice";
import { textOverrides } from "@/app/admin/ui-text/store";
import { makeT } from "@/lib/ui/text";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { confirmNewestPassimpayForUser } from "@/server/billing/passimpay-events";
import { loadPacks, loadPanelSummary } from "@/server/notifications/summary";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Credits and payments | Tharkoo",
  description: "Your Tharkoo credit balance.",
  path: "/u/account/credits/",
  index: false,
});

export default async function Page({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const { payment } = await searchParams;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // H18.1: back from the payment page. A lost webhook must not lose the credits: ask PassimPay about the buyer's newest waiting payment.
  if (payment === "success") {
    const found = await userFromToken(token);
    if (found) await confirmNewestPassimpayForUser(found.user.id, randomUUID());
  }
  const t = makeT(await textOverrides());
  const kind = payment === "success" ? "success" : payment === "failed" ? "failed" : null;
  const [summary, packs] = await Promise.all([loadPanelSummary(token), loadPacks()]);
  return (
    <>
      {kind ? <PaymentNotice kind={kind} text={t(kind === "success" ? "recharge.return.success" : "recharge.return.failed")} /> : null}
      <CoinsPanel summary={summary} packs={packs} />
    </>
  );
}
