import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/ui/EmptyState";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Team & roles">
      <EmptyState title="Coming" why="This screen is planned and not built yet. Nothing is broken; the rest of the admin works as before." action={{ label: "Back to Dashboard", href: "/admin/" }} />
    </AdminShell>
  );
}
