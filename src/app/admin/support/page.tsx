import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Support desk">
      <p className="mb-3 text-[13px] text-[#555]">Tickets as CMS pages in this slice.</p>
      <CollectionEditor model="Page" title="Support desk" />
    </AdminShell>
  );
}
