import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { UrlsManager } from "@/components/admin/UrlsManager";
import { connectDb } from "@/lib/db";
import { siteUrl } from "@/lib/utils";
import { Redirect } from "@/server/models/cms";
import { listNotFound } from "@/server/seo/notfound-log";
import { overrideFromDoc, urlManagerData } from "@/server/urls/service";
import { SeoTabs } from "@/app/admin/seo/SeoTabs";
import { NotFoundMonitor } from "./NotFoundMonitor";
import { OverridesPanel } from "./OverridesPanel";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overrides", label: "Page overrides" },
  { key: "404", label: "404 monitor" },
  { key: "slugs", label: "Slugs & redirects" },
];
const MONITOR_DAYS = 7;

export default async function UrlsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((item) => item.key === rawTab) ? (rawTab as string) : "overrides";
  return (
    <AdminShell title="URLs & Slugs">
      <SeoTabs current="/admin/urls/" />
      <nav aria-label="URL tools" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map((item) => (
          <Link key={item.key} href={`/admin/urls/?tab=${item.key}`} className={item.key === tab ? "adm-btn adm-btn-ghost" : "adm-btn adm-btn-quiet"} aria-current={item.key === tab ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
      {tab === "404" ? <Monitor /> : tab === "slugs" ? <Slugs /> : <Overrides />}
    </AdminShell>
  );
}

async function Overrides() {
  const data = await urlManagerData();
  return <OverridesPanel origin={siteUrl()} overrides={data.overrides.map((row) => overrideFromDoc(row))} />;
}

async function Monitor() {
  const rows = await listNotFound(MONITOR_DAYS);
  await connectDb();
  const redirected = new Set(
    (await Redirect.find({ fromPath: { $in: rows.map((row) => row.path) }, enabled: { $ne: false } }).select("fromPath").lean()).map((row) => row.fromPath),
  );
  return <NotFoundMonitor days={MONITOR_DAYS} rows={rows.map((row) => ({ ...row, redirected: redirected.has(row.path) }))} />;
}

async function Slugs() {
  const data = await urlManagerData();
  return (
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
  );
}
