import { AdminShell } from "@/components/admin/AdminShell";
import { getSite } from "@/lib/queries";
import { DEFAULT_SEO } from "@/lib/seo";
import type { TemplateFields } from "@/lib/seo/landing";
import { listLocations } from "@/server/locations/service";
import { publicCategories } from "@/server/search";
import { listTemplates } from "@/server/seo/templates";
import { SeoTabs } from "../SeoTabs";
import { TemplatesEditor } from "./TemplatesEditor";

export const dynamic = "force-dynamic";

const SAMPLE_CITIES = 20;

function fieldsOf(row: { title?: string; description?: string; h1?: string; intro?: string } | undefined): TemplateFields {
  return { title: row?.title ?? "", description: row?.description ?? "", h1: row?.h1 ?? "", intro: row?.intro ?? "" };
}

export default async function SeoTemplatesPage() {
  const [templates, categories, cities, site] = await Promise.all([
    listTemplates(),
    publicCategories(),
    listLocations({ type: "city" }),
    getSite(),
  ]);
  const defaults = DEFAULT_SEO as unknown as Record<string, Parameters<typeof fieldsOf>[0]>;
  return (
    <AdminShell title="SEO templates">
      <SeoTabs current="/admin/seo/templates/" />
      <TemplatesEditor
        initial={templates.map((row) => ({ key: row.key, fields: row.fields }))}
        defaults={{
          home: fieldsOf(defaults.home),
          category: fieldsOf(defaults.category),
          location: fieldsOf(defaults.location),
          district: fieldsOf(defaults.location),
        }}
        categories={categories.map((item) => ({ slug: item.slug, name: item.name }))}
        cities={cities.slice(0, SAMPLE_CITIES).map((city) => city.name)}
        siteName={site.name || "Tharkoo"}
      />
    </AdminShell>
  );
}
