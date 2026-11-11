import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Ads">
      <p className="mb-3 t-small text-muted">Full ad records. Change title, photos, variant, city, status — the public feed updates.</p>
      <CollectionEditor model="Listing" title="Ads" />
    </AdminShell>
  );
}
