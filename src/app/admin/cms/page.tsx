import { AdminShell } from "@/components/admin/AdminShell";
import { HomepageEditor } from "@/components/admin/HomepageEditor";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="CMS — homepage, banners, static pages">
      <p className="mb-4 text-[13px]">
        The homepage is a list of blocks. Reorder, hide, or add hero / categories / boost / HTML / cities.
        Category copy is under Categories. Static legal pages are below.
      </p>
      <HomepageEditor />
      <h2 className="mb-2 mt-10 text-[18px] font-bold">Banners</h2>
      <CollectionEditor model="Banner" title="Banners" createTemplate={{ slot: "dashboard", title: "Banner", enabled: true, order: 1 }} />
      <h2 className="mb-2 mt-10 text-[18px] font-bold">Static pages</h2>
      <CollectionEditor model="Page" title="Pages" createTemplate={{ slug: "new-page", title: "New page", body: "", status: "published" }} />
    </AdminShell>
  );
}
