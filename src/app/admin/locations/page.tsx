import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { canEditSite } from "@/lib/ui/site-content";
import { loadPlacesScreen, parsePlacesQuery } from "@/server/locations/screen";
import { PlacesScreen } from "./_screen/PlacesScreen";
import { tabOf } from "./_screen/model";

export const dynamic = "force-dynamic";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** Cities & areas (H8.52): one master-detail screen. `?place=` names the place, `?tab=` the tab, `?q=` and `?page=` the list, so links and Back work. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getStaffFromHeaders();
  if (!canEditSite(identity.roles)) {
    return (
      <AdminShell title="Cities & areas" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open Cities &amp; areas</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for admins and content editors. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const params = await searchParams;
  const data = await loadPlacesScreen(parsePlacesQuery(params));
  return (
    <AdminShell title="Cities & areas" hasHeader>
      <PlacesScreen data={data} tab={tabOf(one(params.tab))} />
    </AdminShell>
  );
}
