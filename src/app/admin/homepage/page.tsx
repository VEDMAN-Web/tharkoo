import { loadHomepageForAdmin } from "@/app/admin/content-actions";
import { AdminShell } from "@/components/admin/AdminShell";
import { LayoutEditor } from "@/components/admin/layout-editor/LayoutEditor";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { canonical } from "@/lib/seo";
import { isAdminRole } from "@/lib/ui/site-content";
import { typesForPage } from "@/server/layout/blocks";
import { HomeSeoSection } from "./HomeSeoSection";

export const dynamic = "force-dynamic";

export default async function HomepageAdminPage() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Home page">
        <p>Only an admin can edit the home page.</p>
      </AdminShell>
    );
  }
  const content = await loadHomepageForAdmin();
  return (
    <AdminShell title="Home page">
      <div className="adm-stack">
        <HomeSeoSection
          initial={{ seoTitle: content.seoTitle, seoDescription: content.seoDescription }}
          siteLabel={canonical("/").replace(/^https?:\/\//, "")}
        />
      </div>
      <p className="mb-4 t-small text-muted">
        Build the home page from blocks: add, reorder, hide or schedule them and change every word and photo. Save a draft, preview it, then publish.
      </p>
      <LayoutEditor
        pageKey="home"
        scope="default"
        allowedTypes={typesForPage("home")}
        previewHref="/admin/homepage/preview/"
        seoHref="/admin/seo/"
      />
    </AdminShell>
  );
}
