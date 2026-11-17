import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { getReceipt } from "@/server/admin/orders";
import { NotFoundError } from "@/server/http";

export const dynamic = "force-dynamic";

const STATUS_WORDS: Record<string, string> = { paid: "Paid", pending: "Waiting", failed: "Failed", cancelled: "Cancelled", expired: "Expired" };

/** H8.22: the receipt of one recharge, for staff. A test payment says so on the page. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "orders.view")) notFound();
  const { id } = await params;
  const receipt = await getReceipt(id, identity.roles).catch((error) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!receipt) notFound();
  const rows: [string, string][] = [
    ["Receipt", receipt.no],
    ["Date", receipt.at ? new Date(receipt.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "unknown"],
    ["User", `${receipt.user}${receipt.email ? ` (${receipt.email})` : ""}`],
    ["Method", receipt.method],
    ["Amount", receipt.amount],
    ["Credits", receipt.credits.toLocaleString("en-IN")],
    ["Status", STATUS_WORDS[receipt.status] ?? receipt.status],
  ];
  return (
    <AdminShell title={`Receipt ${receipt.no}`} hasHeader>
      <section className="adm-card" style={{ padding: 24, display: "grid", gap: 12, maxWidth: 560 }} data-tk="receipt-page">
        <h1 style={{ margin: 0, fontSize: 20 }}>Receipt {receipt.no}</h1>
        {receipt.test ? <p style={{ margin: 0, fontWeight: 700 }} data-tk="receipt-test">TEST. This was a test payment. No money was taken, and it is not counted in sales.</p> : null}
        <dl style={{ margin: 0, display: "grid", gap: 8 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "110px minmax(0, 1fr)", gap: 12 }}>
              <dt style={{ color: "var(--adm-kmuted, #5b6275)" }}>{label}</dt>
              <dd style={{ margin: 0, fontWeight: 600, overflowWrap: "anywhere" }}>{value}</dd>
            </div>
          ))}
        </dl>
        <Link href="/admin/finance/" className="adm-btn adm-btn-quiet">Back to Orders &amp; credits</Link>
      </section>
    </AdminShell>
  );
}
