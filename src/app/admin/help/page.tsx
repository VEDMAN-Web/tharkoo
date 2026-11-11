import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Help editor">
      <p className="mb-3 t-small text-muted">Help centre articles.</p>
      <CollectionEditor model="HelpArticle" title="Help editor" />
    </AdminShell>
  );
}
