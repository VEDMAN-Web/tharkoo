import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { pageMetadata } from "@/lib/ui/meta";
import { makeT } from "@/lib/ui/text";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { readOwnPayment } from "@/server/billing/recharge";
import { methodLabel } from "@/components/recharge/labels";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({ title: "Receipt | Tharkoo", description: "Your credit purchase receipt.", path: "/u/account/credits/receipt/", index: false });

export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!found) redirect(`/u/login/?next=${encodeURIComponent(`/u/account/credits/receipt/${paymentId}/`)}`);
  const payment = await readOwnPayment(found.user.id, paymentId).catch(() => null);
  if (!payment) notFound();
  const t = makeT();
  const rows: [string, string][] = [
    [t("receipt.no"), payment.receiptNo],
    [t("history.when"), payment.createdAt ? new Date(payment.createdAt).toLocaleString("en-IN") : ""],
    [t("history.method"), methodLabel(payment)],
    [t("history.amount"), `Rs ${payment.amount.toLocaleString("en-IN")}`],
    [t("history.credits"), payment.credits.toLocaleString("en-IN")],
    [t("history.status"), t(`history.status.${payment.status}` as "history.status.paid")],
  ];
  return (
    <main className="tkc-page" data-tk="receipt" style={{ display: "flex", justifyContent: "center", padding: "28px 16px 40px" }}>
      <section style={{ width: "min(480px, 100%)", border: "1px solid #ead8f0", borderRadius: 16, padding: 24, background: "#fff" }}>
        <p style={{ margin: 0, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#5b3d7a" }}>{t("receipt.merchant")}</p>
        <h1 className="t-h2" style={{ margin: "8px 0 16px" }}>{t("receipt.title")}</h1>
        <dl style={{ display: "grid", gap: 8, margin: 0 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <dt style={{ color: "#5b3d7a" }}>{label}</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="t-small text-muted" style={{ marginTop: 16 }}>{t("receipt.test")}</p>
        <Link href="/u/account/credits/history/" style={{ display: "inline-flex", minHeight: 44, alignItems: "center", fontWeight: 700, color: "#a8124f" }}>{t("receipt.back")}</Link>
      </section>
    </main>
  );
}
