import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Categories">
      <p className="mb-3 text-[13px] text-[#555]">Names, colours, home blurbs, showOnHome, homeCities drive the homepage blocks.</p>
      <CollectionEditor model="Category" title="Categories" />
    </AdminShell>
  );
}
