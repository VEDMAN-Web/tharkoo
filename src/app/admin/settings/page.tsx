import { AdminShell } from "@/components/admin/AdminShell";
import Link from "next/link";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Settings">
      <p className="mb-3 t-small text-muted">Age gate, cookies, hours and brand. Also on the CMS homepage editor.</p>
      <p className="mb-3 t-small">
        Live video tours: <Link href="/admin/settings/video-tours/">switch on per category and set the coin price</Link>.
      </p>
      <CollectionEditor model="Site" title="Settings" />
    </AdminShell>
  );
}
