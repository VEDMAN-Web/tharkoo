import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Broadcasts">
      <p className="mb-3 text-[13px] text-[#555]">Banners double as broadcast copy.</p>
      <CollectionEditor model="Banner" title="Broadcasts" />
    </AdminShell>
  );
}
