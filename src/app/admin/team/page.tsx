import { AdminShell } from "@/components/admin/AdminShell";
import { Notice } from "@/components/admin/ui";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { listStaff } from "@/server/admin/team";
import { TeamView } from "./_team/TeamView";

export const dynamic = "force-dynamic";

/** H8.46 (A46): Team and roles. Superadmin only. Staff list, invite, change roles, remove access. */
export default async function Page() {
  const viewer = await getStaffFromHeaders();
  if (!can(viewer.roles, "team.edit")) {
    return (
      <AdminShell title="Team & roles" hasHeader>
        <Notice kind="warn" title="Not for your role">Only a superadmin can change who is on the team.</Notice>
      </AdminShell>
    );
  }
  const staff = await listStaff(viewer.email);
  return (
    <AdminShell title="Team & roles" hasHeader>
      <TeamView staff={staff} />
    </AdminShell>
  );
}
