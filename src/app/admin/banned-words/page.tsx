import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Banned words">
      <p className="mb-3 t-small text-muted">Title check in the post wizard flags these.</p>
      <CollectionEditor model="BannedWord" title="Banned words" />
    </AdminShell>
  );
}
