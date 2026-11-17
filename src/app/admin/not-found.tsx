import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/ui/EmptyState";

export default function AdminNotFound() {
  return (
    <AdminShell title="Page not found">
      <EmptyState title="Page not found" why="There is no admin page at this address. It may have moved, or the address has a typing mistake." action={{ label: "Back to Dashboard", href: "/admin/" }} />
    </AdminShell>
  );
}
