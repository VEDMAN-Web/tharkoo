import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { homePickerData } from "@/server/listings/home-selection";
import { HomeSelection } from "../HomeSelection";

export const dynamic = "force-dynamic";

export default async function Page() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Order and pins">
        <p className="t-small text-muted">Only an admin can choose the ads on Home. <Link href="/admin/ads/">Back to All ads</Link></p>
      </AdminShell>
    );
  }
  const picker = await homePickerData();
  return (
    <AdminShell title="Order and pins">
      <p className="mb-3 t-small text-muted">Pick the ads that come first on the Home page and put them in order. <Link href="/admin/ads/">Back to All ads</Link></p>
      <HomeSelection pinned={picker.pinned} results={picker.results} />
    </AdminShell>
  );
}
