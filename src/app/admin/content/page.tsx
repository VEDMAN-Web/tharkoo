import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/ui/EmptyState";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Content studio">
      <div className="adm-stack">
        <EmptyState title="Coming" why="This screen is planned and not built yet. The old editors still work:" action={{ label: "Back to Dashboard", href: "/admin/" }} />
        <nav aria-label="Old screens" className="adm-stack">
          <Link href="/admin/blog/" className="adm-btn adm-btn-quiet">Blog posts</Link>
          <Link href="/admin/help/" className="adm-btn adm-btn-quiet">Help articles</Link>
        </nav>
      </div>
    </AdminShell>
  );
}
