import { AdminShell } from "@/components/admin/AdminShell";
import Link from "next/link";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { idCheckRequired } from "@/server/settings/id-check";
import { IdCheckSwitch } from "./IdCheckSwitch";

export const dynamic = "force-dynamic";

export default async function Page() {
  // H6.14: the ID-check switch is for superadmins only. Others do not see it.
  const identity = await getStaffFromHeaders();
  const isSuperadmin = identity.roles.includes("superadmin");
  return (
    <AdminShell title="Settings">
      {isSuperadmin ? <IdCheckSwitch initial={await idCheckRequired()} /> : null}
      <p className="mb-3 t-small text-muted">Age gate, cookies, hours and brand. Also on the CMS homepage editor.</p>
      <p className="mb-3 t-small">
        Live video tours: <Link href="/admin/settings/video-tours/">switch on per category and set the coin price</Link>.
      </p>
      <CollectionEditor model="Site" title="Settings" />
    </AdminShell>
  );
}
