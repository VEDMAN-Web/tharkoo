import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { DataTable, type Column } from "@/components/admin/ui";
import { listRefundBlockedPurchases } from "@/server/wallet";

export const dynamic = "force-dynamic";

type BlockedRefund = Awaited<ReturnType<typeof listRefundBlockedPurchases>>[number];

const COLUMNS: Column<BlockedRefund>[] = [
  { key: "updatedAt", label: "Updated" },
  { key: "userId", label: "User" },
  { key: "coins", label: "Coins", sortable: true },
  { key: "amount", label: "Paid (INR)", sortable: true },
  { key: "eventId", label: "Provider event" },
];

export default async function Page() {
  const blocked = await listRefundBlockedPurchases();
  return (
    <AdminShell title="Finance">
      <section className="mb-6">
        <h2 className="mb-2">Refunds to handle by hand</h2>
        <p className="mb-3 t-small text-muted">
          The provider refunded these purchases after the coins were already spent. Nothing was taken back automatically.
        </p>
        <DataTable columns={COLUMNS} rows={blocked} rowKey={(row) => row.id} csvName="refund-blocked" />
      </section>
      <p className="mb-3 t-small text-muted">Pack prices stand in for finance rows.</p>
      <CollectionEditor model="CreditPack" title="Finance" />
    </AdminShell>
  );
}
