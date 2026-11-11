import Link from "next/link";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { itemListNode } from "@/lib/seo/schema";
import { getCategories } from "@/lib/queries";
import { categoriesPath, categoryPath } from "@/lib/urls";
import { pageMetadata } from "@/lib/ui/meta";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Categories | Tharkoo",
  description: "Browse every Tharkoo classified category, from dating and jobs to homes, vehicles, pets, and local services.",
  path: "/categories/",
});

export default async function CategoriesPage() {
  const categories = await getCategories().catch(() => []);
  const crumbs = [
    { name: "Tharkoo India", path: "/" },
    { name: "Categories", path: categoriesPath() },
  ];
  return (
    <div className="tk-container" style={{ paddingTop: 16, paddingBottom: 24 }}>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Categories",
            url: canonical(categoriesPath()),
            mainEntity: itemListNode({
              url: canonical(categoriesPath()),
              total: categories.length,
              items: categories.map((cat, index) => ({
                position: index + 1,
                name: cat.name || cat.slug || "Category",
                url: canonical(categoryPath(cat.slug || "")),
              })),
            }),
          },
        ]}
      />
      <h1>Categories</h1>
      <ul>
        {categories.map((cat) => (
          <li key={cat.slug}>
            <Link href={categoryPath(cat.slug || "")}>{cat.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
