import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { ShellEditor } from "@/app/admin/menus/ShellEditor";
import { readStoredShellConfig } from "@/server/site-links/shell-config";

export const dynamic = "force-dynamic";

/** H7.1: the live chat bubble text, quick buttons and topic buttons. Admins and superadmins only. */
export default async function ChatSettingsPage() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Support chat">
        <p>Only an admin can edit the support chat.</p>
      </AdminShell>
    );
  }
  return (
    <AdminShell title="Support chat">
      <p className="mb-4 t-small text-muted">
        Text and buttons for the live chat bubble. Each chat becomes a ticket in the <Link href="/admin/support/">Support desk</Link>.
      </p>
      <ShellEditor initial={await readStoredShellConfig()} section="chat" />
    </AdminShell>
  );
}
