import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { DataTable, Notice, type Column } from "@/components/admin/ui";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { getFinanceSettings, listPayoutsForStaff, listRefundBlockedPurchases } from "@/server/wallet";
import { PayoutsQueue, type PayoutRow } from "@/app/admin/finance/PayoutsQueue";
import { TaxSettingsForm } from "@/app/admin/finance/TaxSettingsForm";

export const dynamic = "force-dynamic";

type BlockedRefund = Awaited<ReturnType<typeof listRefundBlockedPurchases>>[number];

const COLUMNS: Column<BlockedRefund>[] = [
  { key: "updatedAt", label: "Updated" },
  { key: "userId", label: "User" },
  { key: "coins", label: "Coins", sortable: true },
  { key: "amount", label: "Paid (INR)", sortable: true },
  { key: "eventId", label: "Provider event" },
];

const FINANCE_ROLES = ["finance", "superadmin"];

export default async function Page() {
  const viewer = await getStaffFromHeaders();
  const canFinance = viewer.roles.some((role) => FINANCE_ROLES.includes(role));
  const [blocked, payouts, settings] = await Promise.all([
    listRefundBlockedPurchases(),
    canFinance ? listPayoutsForStaff({ roles: viewer.roles }) : Promise.resolve([] as PayoutRow[]),
    getFinanceSettings(),
  ]);
  return (
    <AdminShell title="Finance">
      <section className="mb-6" aria-labelledby="payouts-heading">
        <h2 id="payouts-heading" className="mb-2">Payouts</h2>
        <p className="mb-3 t-small text-muted">
          Vendor withdrawals. Approve sends the payout through the payout provider. Coins return to the vendor if a payout is rejected or fails.
        </p>
        {canFinance ? (
          <PayoutsQueue rows={payouts} />
        ) : (
          <Notice kind="warn" title="Finance role needed">
            Ask a superadmin to add the finance role to view payouts.
          </Notice>
        )}
      </section>
      <section className="mb-6" aria-labelledby="tax-heading">
        <h2 id="tax-heading" className="mb-2">TDS, GST and payout rules</h2>
        {canFinance ? <TaxSettingsForm initial={settings} /> : <p className="t-small text-muted">Finance role needed to change these values.</p>}
      </section>
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
