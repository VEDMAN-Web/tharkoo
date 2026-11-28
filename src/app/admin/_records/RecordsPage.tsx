import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { KINDS, type RecordKind } from "@/lib/admin/record-kinds";
import { fieldChoices, getRecord, listRecords, parseRecordsQuery, type RecordDetail } from "@/server/admin/records";
import { NotFoundError } from "@/server/http";
import { RecordsView } from "./RecordsView";

/** The server half of the generic list and edit screens (H8.36): the role check, the list, and the open record from the address. */
export async function RecordsPage({ kind, searchParams }: { kind: RecordKind; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const config = KINDS[kind];
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, config.view)) {
    return (
      <AdminShell title={config.title} hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>{`You cannot open ${config.title}`}</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>{kind === "flags" ? "Only a superadmin can open this screen." : "This screen is for admins and the team that edits the site. Ask an admin if you need it."}</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const params = await searchParams;
  const list = await listRecords(identity.roles, kind, parseRecordsQuery(params));
  const choices = await fieldChoices(identity.roles, kind);
  const open = typeof params.open === "string" ? params.open : "";
  let detail: RecordDetail | null = null;
  if (open && open !== "new") {
    try {
      detail = await getRecord(identity.roles, kind, open);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
  return (
    <AdminShell title={config.title} hasHeader>
      <RecordsView
        kind={kind}
        list={list}
        choices={choices}
        detail={detail}
        isNew={open === "new" && can(identity.roles, config.write)}
        access={{ write: can(identity.roles, config.write), remove: can(identity.roles, config.remove), raw: can(identity.roles, "raw.json") }}
      />
    </AdminShell>
  );
}
