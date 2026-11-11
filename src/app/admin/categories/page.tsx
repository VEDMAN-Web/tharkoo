import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Categories">
      <p className="mb-3 t-small text-muted">Names, colours, home blurbs, showOnHome, homeCities drive the homepage blocks.</p>
      <CollectionEditor model="Category" title="Categories" />
    </AdminShell>
  );
}
