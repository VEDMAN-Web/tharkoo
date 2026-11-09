import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Slots & Star inventory">
      <p className="mb-3 text-[13px] text-[#555]">Star capacity is a product field in this demo.</p>
      <CollectionEditor model="Product" title="Slots & Star inventory" />
    </AdminShell>
  );
}
