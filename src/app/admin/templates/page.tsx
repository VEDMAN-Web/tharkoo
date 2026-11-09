import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Message templates">
      <p className="mb-3 text-[13px] text-[#555]">Use pages as email/SMS template bodies.</p>
      <CollectionEditor model="Page" title="Message templates" />
    </AdminShell>
  );
}
