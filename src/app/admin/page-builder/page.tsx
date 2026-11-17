import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { PageBuilderScreen } from "./PageBuilderScreen";

export const dynamic = "force-dynamic";

/** H8.16 (A16): the Page builder. The Home tab edits the format 2 home layout; the other tabs still point to the old editors. */
export default async function Page() {
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "pages.edit")) {
    return (
      <AdminShell title="Page builder" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h1 style={{ margin: 0, fontSize: 16 }}>You cannot open the Page builder</h1>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  return (
    <AdminShell title="Page builder" hasHeader>
      <PageBuilderScreen />
    </AdminShell>
  );
}
