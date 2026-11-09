import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Finance">
      <p className="mb-3 text-[13px] text-[#555]">Pack prices stand in for finance rows.</p>
      <CollectionEditor model="CreditPack" title="Finance" />
    </AdminShell>
  );
}
