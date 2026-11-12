import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/ui";
import { loadLastRunRows } from "@/app/admin/seo/overview";
import { pageTypeOfPath } from "@/server/seo/explain";
import { SeoTabs } from "../SeoTabs";
import { PagesTable, type PageRow } from "./PagesTable";

export const dynamic = "force-dynamic";

export default async function SeoPagesPage() {
  const { at, rows } = await loadLastRunRows();
  const data: PageRow[] = rows.map((row) => ({
    path: row.path,
    type: pageTypeOfPath(row.path),
    status: row.status,
    inSitemap: row.inSitemap,
    indexable: row.status === 200 && !row.noindex,
    title: row.title,
    desc: row.desc ?? "",
    h1: row.h1 ?? "",
    canonical: row.canonical ?? "",
    words: row.words ?? 0,
    schema: (row.ld ?? []).join(", "),
    issues: [...row.p0.map((text) => `P0: ${text}`), ...row.p1.map((text) => `P1: ${text}`)],
  }));
  return (
    <AdminShell title="Pages & issues">
      <SeoTabs current="/admin/seo/pages/" />
      {rows.length === 0 ? (
        <EmptyState title="No pages checked yet" why="Run an SEO check on the overview screen first." action={{ label: "Open SEO overview", href: "/admin/seo/" }} />
      ) : (
        <div className="adm-stack">
          <p className="adm-field-help" style={{ margin: 0 }}>
            From the check on {at ? new Date(at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}. Click a path to open the right editor.
          </p>
          <PagesTable rows={data} />
        </div>
      )}
    </AdminShell>
  );
}
