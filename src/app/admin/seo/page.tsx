import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="SEO manager">
      <p className="mb-3 t-small text-muted">Title/H1/intro templates with {"{category}"} {"{city}"} variables.</p>
      <CollectionEditor model="SeoTemplate" title="SEO manager" />
    </AdminShell>
  );
}
