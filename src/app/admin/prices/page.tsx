import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/ui/EmptyState";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Prices & plans">
      <div className="adm-stack">
        <EmptyState title="Coming" why="This screen is planned and not built yet. The old money screens still work:" action={{ label: "Back to Dashboard", href: "/admin/" }} />
        <nav aria-label="Old screens" className="adm-stack">
          <Link href="/admin/promotions/" className="adm-btn adm-btn-quiet">Promotions</Link>
          <Link href="/admin/credit-packs/" className="adm-btn adm-btn-quiet">Credit packs</Link>
          <Link href="/admin/coupons/" className="adm-btn adm-btn-quiet">Coupons</Link>
        </nav>
      </div>
    </AdminShell>
  );
}
