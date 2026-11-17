import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { readStoredShellConfig } from "@/server/site-links/shell-config";
import { readLegacySocials, socialStatus } from "@/server/site-links/social-status";
import { MenusEditor } from "./MenusEditor";

export const dynamic = "force-dynamic";

/** H7.1, H8.54: header links, footer and footer contacts for the New design. Admins and superadmins only. */
export default async function MenusAdminPage() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Menus and footer">
        <p>Only an admin can edit the menus and footer.</p>
      </AdminShell>
    );
  }
  const [initial, legacy] = await Promise.all([readStoredShellConfig(), readLegacySocials()]);
  return (
    <AdminShell title="Menus and footer" hasHeader>
      <MenusEditor initial={initial} social={socialStatus(initial, legacy)} />
    </AdminShell>
  );
}
