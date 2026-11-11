import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Users">
      <p className="mb-3 t-small text-muted">Phone numbers appear as users in this demo. Edit ads to change a vendor.</p>
      <CollectionEditor model="Listing" title="Users" />
    </AdminShell>
  );
}
