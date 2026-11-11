import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Admin users & roles">
      <p className="mb-3 t-small text-muted">Demo staff flags.</p>
      <CollectionEditor model="FeatureFlag" title="Admin users & roles" />
    </AdminShell>
  );
}
