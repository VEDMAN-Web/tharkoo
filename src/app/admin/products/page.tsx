import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Products & price matrix">
      <p className="mb-3 text-[13px] text-[#555]">Top / Flash / Star products and credit prices.</p>
      <CollectionEditor model="Product" title="Products & price matrix" />
    </AdminShell>
  );
}
