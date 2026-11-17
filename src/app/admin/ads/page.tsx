import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { listAds, parseAdsQuery } from "@/server/admin/ads-list";
import { demoPanelData } from "@/server/listings/demo-ads";
import { DemoAds } from "./DemoAds";
import { AdsView } from "./_list/AdsView";

export const dynamic = "force-dynamic";

/** H8.27 (A27): All ads. Tab, search, filters and page live in the address; select rows to pause, resume, extend or remove them. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "ads.view")) {
    return (
      <AdminShell title="All ads" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open All ads</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for moderators, trust and safety, support and admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const list = await listAds(identity.roles, parseAdsQuery(await searchParams));
  const demo = list.query.tab === "demo" ? await demoPanelData() : null;
  return (
    <AdminShell title="All ads" hasHeader>
      <AdsView
        list={list}
        access={{ edit: can(identity.roles, "ads.edit"), decide: can(identity.roles, "ads.decide"), create: can(identity.roles, "settings.edit"), pins: can(identity.roles, "settings.edit") }}
        demoPanel={demo ? <DemoAds panel={demo} canEnd={can(identity.roles, "ads.demo.end")} canRestore={can(identity.roles, "ads.demo.restore")} /> : null}
      />
    </AdminShell>
  );
}
