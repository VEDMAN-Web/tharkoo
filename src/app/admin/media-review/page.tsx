import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Media review">
      <p className="mb-3 t-small text-muted">photos[] are clothed placeholders. Swap paths here.</p>
      <CollectionEditor model="Listing" title="Media review" />
    </AdminShell>
  );
}
