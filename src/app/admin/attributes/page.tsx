import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Attributes & form builder">
      <p className="mb-3 text-[13px] text-[#555]">These options appear on Post your ad and search advanced filters.</p>
      <CollectionEditor model="AttributeGroup" title="Attributes & form builder" />
    </AdminShell>
  );
}
