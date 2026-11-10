import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPageView } from "@/components/ListingPage";
import { TAG_PAGES } from "@/data/catalog";
import { getCategory, getFeed, getSite } from "@/lib/queries";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ category: string; tag: string }> }): Promise<Metadata> {
  const { category, tag } = await params;
  const meta = TAG_PAGES.find((item) => item.slug === tag);
  const cat = await getCategory(category);
  if (!cat || !meta) {
    return pageMetadata({
      title: "Page not found | Tharkoo",
      description: "That tag page is not on Tharkoo. Browse a category from the home page instead.",
      path: `/${category}/tag/${tag}/`,
      index: false,
      follow: false,
    });
  }
  return pageMetadata({
    title: `${cat.name} — ${meta.label} | Tharkoo`,
    description: `Browse ${cat.name} ads tagged ${meta.label} on Tharkoo. Open a listing to see the details, photos, and how to get in touch.`,
    path: `/${category}/tag/${tag}/`,
  });
}

export default async function TagPage({ params }: { params: Promise<{ category: string; tag: string }> }) {
  const { category, tag } = await params;
  const meta = TAG_PAGES.find((item) => item.slug === tag);
  const cat = await getCategory(category);
  if (!cat || !meta) notFound();
  const [site, feed] = await Promise.all([getSite(), getFeed({ categorySlug: category }, 1)]);
  return (
    <ListingPageView
      h1={`${cat.name} — ${meta.label}`}
      intro={`Browse ${cat.name} ads tagged ${meta.label}. ${site.name} lists them alongside the rest of the city feed.`}
      crumbs={[
        { name: "India", path: "/" },
        { name: cat.name!, path: `/${category}/` },
        { name: meta.label, path: `/${category}/tag/${tag}/` },
      ]}
      path={`/${category}/tag/${tag}/`}
      stars={[]}
      items={feed.items}
      page={1}
      pages={1}
      total={feed.total}
      siblingLinks={TAG_PAGES.filter((item) => item.slug !== tag).slice(0, 8).map((item) => ({ href: `/${category}/tag/${item.slug}/`, label: item.label }))}
      emptyNearby={[]}
    />
  );
}
