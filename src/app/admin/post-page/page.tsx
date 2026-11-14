import { AdminShell } from "@/components/admin/AdminShell";
import { LayoutEditor } from "@/components/admin/layout-editor/LayoutEditor";
import { PageTitleEditor } from "@/components/admin/PageTitleEditor";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { canonical } from "@/lib/seo";
import { postAdPath } from "@/lib/urls";
import { isAdminRole } from "@/lib/ui/site-content";
import { typesForPage } from "@/server/layout/blocks";
import { parsePageTitleTarget, readPageTitle } from "@/server/seo/page-titles";
import { getPaths } from "@/server/urls/service";

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
  const paths = await getPaths();
  const address = postAdPath(paths);
  const target = parsePageTitleTarget({ kind: "url", path: address });
  const title = await readPageTitle(target);
  return (
    <AdminShell title="Post-ad page">
      <div className="adm-stack" style={{ marginBottom: 16 }}>
        <PageTitleEditor
          target={target}
          initial={{ seoTitle: title.title, seoDescription: title.description }}
          siteLabel={canonical(address).replace(/^https?:\/\//, "")}
          help="The title and description that search engines show for the post-ad page. Saving here changes the same text as Page overrides for that address."
        />
      </div>
      <p className="mb-4 t-small text-muted">
        Change the words of the posting steps, the photo rules, the promotion note and the message after posting. The six steps stay in this order; only the promote step can be hidden. Save a draft, then publish.
      </p>
      <LayoutEditor pageKey="post" scope="default" allowedTypes={typesForPage("post")} previewHref="/u/post-insert/?preview=1" seoHref="/admin/seo/" />
    </AdminShell>
  );
}
