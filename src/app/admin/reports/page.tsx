import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { NotFoundError } from "@/server/http";
import { getReportDetail, listReports, parseReportQuery, type ReportDetail } from "@/server/admin/reports";
import { ReportsView } from "./_list/ReportsView";

export const dynamic = "force-dynamic";

/** H8.21 (A21): Reports and legal takedown. Tab, search, page and the open report live in the address. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "reports.handle")) {
    return (
      <AdminShell title="Reports" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open Reports</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for moderators, trust and safety and admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const params = await searchParams;
  const canLegal = can(identity.roles, "reports.legal");
  const query = parseReportQuery(params);
  if (query.tab === "legal" && !canLegal) query.tab = "open";
  const list = await listReports(identity.roles, query);
  const open = typeof params.open === "string" ? params.open : "";
  let detail: ReportDetail | null = null;
  if (open) {
    try {
      detail = await getReportDetail(identity.roles, query.tab, open);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
  const access = { legal: canLegal, ban: can(identity.roles, "users.ban"), decide: can(identity.roles, "ads.decide") };
  return (
    <AdminShell title="Reports" hasHeader>
      <ReportsView list={list} detail={detail} access={access} />
    </AdminShell>
  );
}
