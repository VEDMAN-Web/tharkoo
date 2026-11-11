import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Products & price matrix">
      <p className="mb-3 t-small text-muted">Top / Flash / Star products and credit prices.</p>
      <CollectionEditor model="Product" title="Products & price matrix" />
    </AdminShell>
  );
}
