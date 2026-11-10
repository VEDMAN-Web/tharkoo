import { AdminShell } from "@/components/admin/AdminShell";
import { UrlsManager } from "@/components/admin/UrlsManager";
import { siteUrl } from "@/lib/utils";
import { urlManagerData } from "@/server/urls/service";

export const dynamic = "force-dynamic";

export default async function UrlsPage() {
  const data = await urlManagerData();
  return (
    <AdminShell title="URLs & Slugs">
      <UrlsManager
        origin={siteUrl()}
        paths={data.paths}
        categories={data.categories.map((row) => ({ id: String(row._id), name: row.name || row.slug || "", slug: row.slug || "" }))}
        places={data.places.map((row) => ({ id: String(row._id), name: row.name || row.slug || "", slug: row.slug || "", type: row.type || "" }))}
        tags={data.tags}
        pages={data.pages.map((row) => ({ id: String(row._id), title: row.title || row.slug || "", slug: row.slug || "" }))}
        posts={data.posts.map((row) => ({ id: String(row._id), title: row.title || row.slug || "", slug: row.slug || "" }))}
        redirects={data.redirects.map((row) => ({
          id: String(row._id),
          from: row.fromPath || "",
          to: row.toPath || "",
          hits: row.hits || 0,
          enabled: row.enabled !== false,
        }))}
        overrides={data.overrides.map((row) => ({
          path: row.path || "",
          title: row.title || "",
          description: row.description || "",
          h1: row.h1 || "",
          canonical: row.canonical || "",
          noindex: row.noindex === true,
          ogImage: row.ogImage || "",
        }))}
      />
    </AdminShell>
  );
}
