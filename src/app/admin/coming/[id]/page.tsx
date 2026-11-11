import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { findItem } from "@/components/admin/nav";
import { EmptyState } from "@/components/admin/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function ComingSoon({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = findItem(id);
  if (!entry?.task) notFound();
  return (
    <AdminShell title={entry.label}>
      <EmptyState
        title={`Coming in ${entry.task}`}
        why="This screen is planned and not built yet. Nothing is broken; the rest of the admin works as before."
        action={{ label: "Back to dashboard", href: "/admin/" }}
      />
    </AdminShell>
  );
}
