import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Grievance & takedown log">
      <p className="mb-3 text-[13px] text-[#555]">Legal order pages.</p>
      <CollectionEditor model="Page" title="Grievance & takedown log" />
    </AdminShell>
  );
}
