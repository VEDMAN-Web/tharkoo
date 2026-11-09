import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Audit log">
      <p className="mb-3 text-[13px] text-[#555]">Read-only style list; edits still save.</p>
      <CollectionEditor model="BannedWord" title="Audit log" />
    </AdminShell>
  );
}
