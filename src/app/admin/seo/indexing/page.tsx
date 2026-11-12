import { AdminShell } from "@/components/admin/AdminShell";
import { SITEMAP_SHARDS, shardEntries } from "@/lib/seo/sitemaps";
import { listLocations } from "@/server/locations/service";
import { publicCategories } from "@/server/search";
import { recentSubmissions } from "@/server/indexnow/manual";
import { getIndexing } from "@/server/seo/indexing";
import { SeoTabs } from "../SeoTabs";
import { IndexingForm } from "./IndexingForm";
import { IndexNowBox, SitemapPreview, WhyIndexable, type ShardInfo } from "./IndexingTools";

export const dynamic = "force-dynamic";

const SAMPLE = 20;

async function shardInfo(): Promise<ShardInfo[]> {
  const out: ShardInfo[] = [];
  for (const shard of SITEMAP_SHARDS) {
    const entries = await shardEntries(shard);
    out.push({ shard, count: entries.length, sample: entries.slice(0, SAMPLE).map((entry) => entry.loc) });
  }
  return out;
}

export default async function SeoIndexingPage() {
  const [settings, categories, cities, shards, log] = await Promise.all([
    getIndexing(),
    publicCategories(),
    listLocations({ type: "city" }),
    shardInfo(),
    recentSubmissions(),
  ]);
  return (
    <AdminShell title="Indexing rules & sitemaps">
      <SeoTabs current="/admin/seo/indexing/" />
      <div className="adm-stack">
        <IndexingForm
          initial={settings}
          categories={categories.map((item) => ({ slug: item.slug, name: item.name }))}
          cities={cities.map((city) => ({ slug: city.slug, name: city.name }))}
        />
        <SitemapPreview shards={shards} />
        <WhyIndexable />
        <IndexNowBox keySet={Boolean(process.env.INDEXNOW_KEY)} log={log.map((row) => ({ at: row.at, urls: row.urls, sent: row.sent, note: row.note }))} />
      </div>
    </AdminShell>
  );
}
