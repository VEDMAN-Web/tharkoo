import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { SeoTabs } from "../SeoTabs";
import { FixDashesPanel } from "./FixDashesPanel";

export const dynamic = "force-dynamic";

export default async function SeoToolsPage() {
  const identity = await getStaffFromHeaders();
  const isSuperadmin = identity.roles.includes("superadmin");
  return (
    <AdminShell title="SEO tools">
      <SeoTabs current="/admin/seo/tools/" />
      <div className="adm-stack">
        <section className="adm-card" style={{ display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Long dashes</h2>
          <p style={{ margin: 0 }}>
            Replaces every em dash and en dash in the stored site text: titles, SEO templates, page overrides, categories,
            locations, UI text, page layouts and content pages. Listings are not changed here. It is also run every night by
            the daily job. Running it again changes nothing.
          </p>
          <FixDashesPanel canRun={isSuperadmin} />
        </section>
      </div>
    </AdminShell>
  );
}
