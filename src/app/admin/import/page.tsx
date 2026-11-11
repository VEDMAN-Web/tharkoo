import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const identity = await getStaffFromHeaders();
  const allowed = isStaff(identity) && identity.roles.some((role) => role === "admin" || role === "superadmin");
  return (
    <AdminShell title="Partner import">
      {allowed ? (
        <ImportForm canPublish={identity.roles.includes("superadmin")} />
      ) : (
        <EmptyState
          title="Not available for your role"
          why="Only an admin or a superadmin can import listings for a partner."
          action={{ label: "Back to dashboard", href: "/admin/" }}
        />
      )}
    </AdminShell>
  );
}
