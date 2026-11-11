import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Support desk">
      <p className="mb-3 t-small text-muted">Tickets as CMS pages in this slice.</p>
      <CollectionEditor model="Page" title="Support desk" />
    </AdminShell>
  );
}
