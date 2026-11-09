import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Packs & subscriptions">
      <p className="mb-3 text-[13px] text-[#555]">Publishing packs and subscription plans.</p>
      <CollectionEditor model="Product" title="Packs & subscriptions" />
    </AdminShell>
  );
}
