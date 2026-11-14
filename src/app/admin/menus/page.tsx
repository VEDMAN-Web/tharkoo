import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { readShellConfig } from "@/server/site-links/shell-config";
import { ShellEditor } from "./ShellEditor";

export const dynamic = "force-dynamic";

/** H7.1: header links, footer and footer contacts for the New design. Admins and superadmins only. */
export default async function MenusAdminPage() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Menus and footer">
        <p>Only an admin can edit the menus and footer.</p>
      </AdminShell>
    );
  }
  return (
    <AdminShell title="Menus and footer">
      <p className="mb-4 t-small text-muted">
        Header links, footer columns and contact rows on every public page. The account menu and the Log in and Post your ad targets stay fixed so login and posting keep working.
      </p>
      <ShellEditor initial={await readShellConfig()} section="menus" />
    </AdminShell>
  );
}
