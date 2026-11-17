import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { readPricesData } from "@/server/billing/plans-admin";
import { PricesView } from "./_view/PricesView";

export const dynamic = "force-dynamic";

/** H8.17 (A17): Prices & plans, part 1: posting fee, credit price, paid posting, test payments and the promotion plans. */
export default async function Page() {
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "prices.view") && !can(identity.roles, "prices.edit")) {
    return (
      <AdminShell title="Prices & plans" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open Prices & plans</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for finance and admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  return (
    <AdminShell title="Prices & plans" hasHeader>
      <PricesView data={await readPricesData()} canEdit={can(identity.roles, "prices.edit")} />
    </AdminShell>
  );
}
