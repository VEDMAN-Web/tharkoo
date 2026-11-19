import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { itemListNode } from "@/lib/seo/schema";
import { getCategories, listingCountsByCategoryCity } from "@/lib/queries";
import { categoriesPath, categoryPath, postAdPath, searchPath } from "@/lib/urls";
import { pageMetadata } from "@/lib/ui/meta";
import { getPaths } from "@/server/urls/service";
import { withCategoryIcons } from "@/server/categories/icons";
import { readShellConfig } from "@/server/site-links/shell-config";
import { photoFocusOf, photoOf } from "@/components/h714/photo";
import { CategoriesView, type CategoryCard } from "@/components/h714/CategoriesView";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Categories on Tharkoo: dating, jobs, homes and more | Tharkoo",
  description: "Browse every Tharkoo classified category, from dating and jobs to homes, vehicles, pets, and local services.",
  path: "/categories/",
});

export default async function CategoriesPage() {
  const [categories, counts, paths, shell] = await Promise.all([
    getCategories().then(withCategoryIcons).catch(() => []),
    listingCountsByCategoryCity().catch(() => []),
    getPaths(),
    readShellConfig(),
  ]);
  const adsByCategory = new Map<string, number>();
  for (const row of counts) {
    adsByCategory.set(row._id.categorySlug, (adsByCategory.get(row._id.categorySlug) ?? 0) + row.n);
  }
  const cards: CategoryCard[] = categories
    .filter((cat) => cat.slug)
    .map((cat) => {
      const slug = cat.slug as string;
      const blurb = (cat.homeBlurb || cat.description || "").replace(/\s+/g, " ").trim();
      const ads = `${(adsByCategory.get(slug) ?? 0).toLocaleString("en-IN")} ads`;
      return { slug, name: cat.name || slug, icon: cat.icon, summary: [blurb, ads].filter(Boolean).join(" · "), href: categoryPath(slug), photo: photoOf(shell, "category", slug), photoFocus: photoFocusOf(shell, "category", slug) };
    });
  const crumbs = [
    { name: "Tharkoo India", path: "/" },
    { name: "Categories", path: categoriesPath() },
  ];
  return (
    <>
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
              items: cards.map((cat, index) => ({
                position: index + 1,
                name: cat.name,
                url: canonical(cat.href),
              })),
            }),
          },
        ]}
      />
      <CategoriesView categories={cards} searchHref={searchPath(paths)} postAdHref={postAdPath(paths)} />
    </>
  );
}
