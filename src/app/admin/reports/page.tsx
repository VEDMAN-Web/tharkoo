import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Reports">
      <p className="mb-3 text-[13px] text-[#555]">Store report outcomes as CMS pages or notes.</p>
      <CollectionEditor model="Page" title="Reports" />
    </AdminShell>
  );
}
