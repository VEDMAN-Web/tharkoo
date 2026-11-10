import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Coupons">
      <p className="mb-3 t-small text-muted">Coupon list used on wallet and checkout.</p>
      <CollectionEditor model="Coupon" title="Coupons" />
    </AdminShell>
  );
}
