import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Credit packs">
      <p className="mb-3 t-small text-muted">Wallet packs on /u/account/credits/.</p>
      <CollectionEditor model="CreditPack" title="Credit packs" />
    </AdminShell>
  );
}
