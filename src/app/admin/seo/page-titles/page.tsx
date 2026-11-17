import Link from "next/link";
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
      <p className="adm-field-help" data-tk="titles-listing-link">
        The title and description of the category and listing pages can also be written next to their layout, in the <Link href="/admin/page-builder/?tab=listing">Page builder, Listing pages tab</Link>. It is the same stored text.
      </p>
      <PageTitlesTable rows={rows} />
    </AdminShell>
  );
}
