import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Reports & analytics">
      <p className="mb-3 t-small text-muted">Counts come from live ads.</p>
      <CollectionEditor model="Listing" title="Reports & analytics" />
    </AdminShell>
  );
}
