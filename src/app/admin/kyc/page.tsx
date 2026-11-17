import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { adminContext } from "@/server/admin/context";
import { NotFoundError } from "@/server/http";
import { getIdDetail, listIdChecks, parseIdQuery, type IdDetail } from "@/server/verification/service";
import { IdView } from "./_list/IdView";

export const dynamic = "force-dynamic";

/** H8.23 (A23): ID checks. Tab, search, page and the open check live in the address. Opening a check shows its photos and writes that to the audit log. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "id.decide")) {
    return (
      <AdminShell title="ID checks" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open ID checks</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for moderators, trust and safety and admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const params = await searchParams;
  const list = await listIdChecks(identity.roles, parseIdQuery(params));
  const open = typeof params.open === "string" ? params.open : "";
  let detail: IdDetail | null = null;
  if (open) {
    try {
      const ctx = await adminContext();
      detail = await getIdDetail(ctx.actorId, ctx.roles, open, ctx.requestId);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
  return (
    <AdminShell title="ID checks" hasHeader>
      <IdView list={list} detail={detail} />
    </AdminShell>
  );
}
