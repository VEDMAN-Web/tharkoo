import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Banned words">
      <p className="mb-3 text-[13px] text-[#555]">Title check in the post wizard flags these.</p>
      <CollectionEditor model="BannedWord" title="Banned words" />
    </AdminShell>
  );
}
