import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Blog editor">
      <p className="mb-3 t-small text-muted">Blog posts.</p>
      <CollectionEditor model="BlogPost" title="Blog editor" />
    </AdminShell>
  );
}
