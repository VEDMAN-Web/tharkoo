import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Settings">
      <p className="mb-3 t-small text-muted">Age gate, cookies, hours, brand — also on CMS homepage editor.</p>
      <CollectionEditor model="Site" title="Settings" />
    </AdminShell>
  );
}
