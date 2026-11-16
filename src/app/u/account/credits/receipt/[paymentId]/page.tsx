import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PanelPage } from "@/components/buyer/PanelPage";
import { methodLabel } from "@/components/recharge/labels";
import { pageMetadata } from "@/lib/ui/meta";
import { makeT } from "@/lib/ui/text";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { readOwnPayment } from "@/server/billing/recharge";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({ title: "Receipt | Tharkoo", description: "Your credit purchase receipt.", path: "/u/account/credits/receipt/", index: false });

export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const here = `/u/account/credits/receipt/${paymentId}/`;
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!found) redirect(`/u/login/?next=${encodeURIComponent(here)}`);
  const payment = await readOwnPayment(found.user.id, paymentId).catch(() => null);
  if (!payment) notFound();
  const t = makeT();
  const rows: [string, string][] = [
    [t("receipt.no"), payment.receiptNo],
    [t("history.when"), payment.createdAt ? new Date(payment.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""],
    [t("history.method"), methodLabel(payment)],
    [t("history.amount"), `₹${payment.amount.toLocaleString("en-IN")}`],
    [t("history.credits"), payment.credits.toLocaleString("en-IN")],
    [t("history.status"), t(`history.status.${payment.status}` as "history.status.paid")],
  ];
  return (
    <PanelPage active="coins" next={here} title="Log in to see your receipt" body="Your receipts are kept on your account.">
      <section className="up-glass up-panel" data-tk="receipt" aria-labelledby="receipt-title">
        <div className="up-panel-head">
          <h1 id="receipt-title" className="up-h2">{t("receipt.title")}</h1>
          <p className="up-muted">{t("receipt.merchant")}</p>
        </div>
        <dl className="up-hist-receipt">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="up-muted" style={{ marginTop: 14 }}>{t("receipt.test")}</p>
        <div className="up-actions" style={{ marginTop: 14 }}>
          <Link href="/u/account/credits/history/" className="up-btn-ghost">{t("receipt.back")}</Link>
        </div>
      </section>
    </PanelPage>
  );
}
