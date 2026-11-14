import { AdminShell } from "@/components/admin/AdminShell";
import { listPageTitles } from "@/server/seo/page-titles";
import { SeoTabs } from "../SeoTabs";
import { PageTitlesTable } from "./PageTitlesTable";

export const dynamic = "force-dynamic";

export default async function PageTitlesPage() {
  const rows = await listPageTitles();
  return (
    <AdminShell title="Page titles">
      <SeoTabs current="/admin/seo/page-titles/" />
      <PageTitlesTable rows={rows} />
    </AdminShell>
  );
}
