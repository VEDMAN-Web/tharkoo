import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { listOrders, parseOrderQuery } from "@/server/admin/orders";
import { getFinanceSettings, listPayoutsForStaff, listRefundBlockedPurchases } from "@/server/wallet";
import { OrdersView, type PayoutsPart } from "./_orders/OrdersView";
import { platformCallList, platformCallRevenue } from "@/server/tours/earnings";

export const dynamic = "force-dynamic";

/** H8.22 (A22): Orders & credits, read only. Tab, search, filters, page and the open row all live in the address. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "orders.view")) {
    return (
      <AdminShell title="Orders & credits" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open Orders &amp; credits</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for finance and admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const query = parseOrderQuery(await searchParams);
  const canFinance = can(identity.roles, "payouts.decide");
  const callRevenue = await platformCallRevenue().catch(() => null);
  const callList = await platformCallList().catch(() => []);
  const [list, payouts, blocked] = await Promise.all([
    listOrders(query, identity.roles),
    query.tab === "payouts" && canFinance
      ? Promise.all([listPayoutsForStaff({ roles: identity.roles }), getFinanceSettings()]).then(([rows, settings]): PayoutsPart => ({ canFinance, rows, settings }))
      : Promise.resolve<PayoutsPart>({ canFinance, rows: [], settings: null }),
    query.tab === "refunds" ? listRefundBlockedPurchases() : Promise.resolve([]),
  ]);
  return (
    <AdminShell title="Orders & credits" hasHeader>
      {callRevenue ? (
        <section className="adm-card" style={{ padding: 16, marginBottom: 16 }} data-tk="call-revenue" aria-label="Tharkoo earnings from calls">
          <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Tharkoo earnings from calls</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div><p style={{ margin: 0 }} className="adm-k-help">Today</p><strong data-tk="call-revenue-today">{callRevenue.today} credits</strong></div>
            <div><p style={{ margin: 0 }} className="adm-k-help">Last 7 days</p><strong data-tk="call-revenue-week">{callRevenue.week} credits</strong></div>
            <div><p style={{ margin: 0 }} className="adm-k-help">Last 30 days</p><strong data-tk="call-revenue-month">{callRevenue.month} credits</strong></div>
          </div>
          {callList.length > 0 ? (
            <>
              <h3 style={{ margin: "16px 0 8px", fontSize: 14 }}>Where it came from (latest paid calls)</h3>
              <div className="adm-table-wrap">
                <table className="adm-table" data-tk="call-revenue-list">
                  <thead>
                    <tr>
                      <th scope="col">Ended</th>
                      <th scope="col">Ad</th>
                      <th scope="col">Asked by</th>
                      <th scope="col">Advertiser</th>
                      <th scope="col">Price</th>
                      <th scope="col">Advertiser got</th>
                      <th scope="col">Tharkoo got</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callList.map((call) => (
                      <tr key={call.id}>
                        <td>{call.at ? new Date(call.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : ""}</td>
                        <td>{call.title || "Untitled"}</td>
                        <td>{call.buyer}</td>
                        <td>{call.vendor}</td>
                        <td>{call.price}</td>
                        <td>{call.vendorPart}</td>
                        <td><strong>{call.fee}</strong></td>
                        <td>{call.status === "completed" ? "Completed" : call.status === "reversed" ? "Reversed" : call.status === "reversing" ? "Reversing" : "Disputed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
      <OrdersView list={list} payouts={payouts} blocked={blocked} />
    </AdminShell>
  );
}
