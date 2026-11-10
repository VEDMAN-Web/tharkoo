import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Moderation queue">
      <p className="mb-3 t-small text-muted">Filter by editing status to pending in JSON.</p>
      <CollectionEditor model="Listing" title="Moderation queue" />
    </AdminShell>
  );
}
