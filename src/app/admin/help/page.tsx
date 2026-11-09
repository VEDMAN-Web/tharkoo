import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Help editor">
      <p className="mb-3 text-[13px] text-[#555]">Help centre articles.</p>
      <CollectionEditor model="HelpArticle" title="Help editor" />
    </AdminShell>
  );
}
