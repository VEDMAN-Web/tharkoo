import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Translations">
      <p className="mb-3 t-small text-muted">String keys as pages.</p>
      <CollectionEditor model="Page" title="Translations" />
    </AdminShell>
  );
}
