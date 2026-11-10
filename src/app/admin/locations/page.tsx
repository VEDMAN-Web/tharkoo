import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Locations">
      <p className="mb-3 t-small text-muted">Country / state / city / district. isTop and sortOrder pick homepage cities.</p>
      <CollectionEditor model="Location" title="Locations" />
    </AdminShell>
  );
}
