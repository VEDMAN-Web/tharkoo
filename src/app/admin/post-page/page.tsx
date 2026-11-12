import { AdminShell } from "@/components/admin/AdminShell";
import { LayoutEditor } from "@/components/admin/layout-editor/LayoutEditor";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { typesForPage } from "@/server/layout/blocks";

export const dynamic = "force-dynamic";

export default async function PostPageAdminPage() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Post-ad page">
        <p>Only an admin can edit the post-ad page.</p>
      </AdminShell>
    );
  }
  return (
    <AdminShell title="Post-ad page">
      <p className="mb-4 t-small text-muted">
        Change the words of the posting steps, the photo rules, the promotion note and the message after posting. The six steps stay in this order; only the promote step can be hidden. Save a draft, then publish.
      </p>
      <LayoutEditor pageKey="post" scope="default" allowedTypes={typesForPage("post")} previewHref="/u/post-insert/?preview=1" seoHref="/admin/seo/" />
    </AdminShell>
  );
}
