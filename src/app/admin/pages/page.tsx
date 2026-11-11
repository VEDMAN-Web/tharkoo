import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Pages">
      <p className="mb-3 t-small text-muted">Published CMS pages. The public address is /cms/the-slug/.</p>
      <CollectionEditor
        model="Page"
        title="Pages"
        createTemplate={{ slug: "new-page", title: "New page", body: "", status: "published" }}
        summaryFields={["status", "title"]}
      />
    </AdminShell>
  );
}
