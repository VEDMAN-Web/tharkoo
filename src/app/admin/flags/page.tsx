import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Feature flags">
      <p className="mb-3 text-[13px] text-[#555]">Toggles per product area.</p>
      <CollectionEditor model="FeatureFlag" title="Feature flags" />
    </AdminShell>
  );
}
