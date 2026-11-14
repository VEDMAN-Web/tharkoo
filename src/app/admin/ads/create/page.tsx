import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { loadAdFormOptions } from "@/server/listings/admin-form";
import { CreateAdForm } from "./CreateAdForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const identity = await getStaffFromHeaders();
  const allowed = isStaff(identity) && identity.roles.some((role) => role === "admin" || role === "superadmin");
  return (
    <AdminShell title="Create ad">
      {allowed ? (
        <CreateAdForm options={await loadAdFormOptions()} canPublish={identity.roles.includes("superadmin")} />
      ) : (
        <EmptyState
          title="Not available for your role"
          why="Only an admin or a superadmin can create an ad for an account."
          action={{ label: "Back to dashboard", href: "/admin/" }}
        />
      )}
    </AdminShell>
  );
}
