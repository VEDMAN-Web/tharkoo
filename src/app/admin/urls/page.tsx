import { AdminShell } from "@/components/admin/AdminShell";
import { UrlsManager } from "@/components/admin/UrlsManager";
import { siteUrl } from "@/lib/utils";
import { overrideFromDoc, urlManagerData } from "@/server/urls/service";
import { SeoTabs } from "@/app/admin/seo/SeoTabs";
import { OverridesPanel } from "./OverridesPanel";

export const dynamic = "force-dynamic";

export default async function UrlsPage() {
  const data = await urlManagerData();
  return (
    <AdminShell title="URLs & Slugs">
      <SeoTabs current="/admin/urls/" />
      <div className="adm-stack">
        <OverridesPanel origin={siteUrl()} overrides={data.overrides.map((row) => overrideFromDoc(row))} />
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
        />
      </div>
    </AdminShell>
  );
}
