import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="CMS: banners and static pages">
      <p className="mb-4 text-[13px]">
        Edit the home page under <Link href="/admin/homepage/" className="text-accent">Homepage</Link> and the header and footer under{" "}
        <Link href="/admin/menus/" className="text-accent">Menus</Link>.
      </p>
      <h2 className="mb-2 mt-10 text-[18px] font-bold">Banners</h2>
      <CollectionEditor model="Banner" title="Banners" createTemplate={{ slot: "dashboard", title: "Banner", enabled: true, order: 1 }} />
      <h2 className="mb-2 mt-10 text-[18px] font-bold">Static pages</h2>
      <CollectionEditor model="Page" title="Pages" createTemplate={{ slug: "new-page", title: "New page", body: "", status: "published" }} />
    </AdminShell>
  );
}
