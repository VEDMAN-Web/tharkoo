import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/ui/EmptyState";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Page builder">
      <div className="adm-stack">
        <EmptyState title="Coming" why="This screen is planned and not built yet. The old page editors still work:" action={{ label: "Back to Dashboard", href: "/admin/" }} />
        <nav aria-label="Old screens" className="adm-stack">
          <Link href="/admin/homepage/" className="adm-btn adm-btn-quiet">Home page</Link>
          <Link href="/admin/listing-pages/" className="adm-btn adm-btn-quiet">Listing pages</Link>
          <Link href="/admin/post-page/" className="adm-btn adm-btn-quiet">Post-ad page</Link>
        </nav>
      </div>
    </AdminShell>
  );
}
