import { AdminShell } from "@/components/admin/AdminShell";
import { LayoutEditor } from "@/components/admin/layout-editor/LayoutEditor";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { typesForPage } from "@/server/layout/blocks";

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
  return (
    <AdminShell title="Home page">
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
