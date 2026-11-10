import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPageView } from "@/components/ListingPage";
import { TAG_PAGES } from "@/data/catalog";
import { getCategory, getFeed, getSite } from "@/lib/queries";
import { pageMetadata } from "@/lib/ui/meta";

export const revalidate = 300;

async function tagLabel(category: string, tag: string) {
  const known = TAG_PAGES.find((item) => item.slug === tag);
  if (known) return known;
  const site = await getSite();
  const extra = ((site as { tags?: { slug?: string; label?: string }[] }).tags || []).find((item) => item.slug === tag);
  return extra?.slug ? { slug: extra.slug, label: extra.label || extra.slug } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; tag: string }> }): Promise<Metadata> {
  const { category, tag } = await params;
  const [meta, cat, feed] = await Promise.all([tagLabel(category, tag), getCategory(category), getFeed({ categorySlug: category, tag }, 1)]);
  if (!cat || !meta) {
    return pageMetadata({
      title: "Page not found | Tharkoo",
      description: "That tag page is not on Tharkoo. Browse a category from the home page instead.",
      path: `/${category}/tag/${tag}/`,
      index: false,
      follow: false,
    });
  }
  const live = feed.total >= 1;
  return pageMetadata({
    title: `${meta.label} ${cat.name} ads | Tharkoo`,
    description: `Browse ${cat.name} ads tagged ${meta.label} on Tharkoo. Open a listing to see the details, photos, and how to get in touch.`,
    path: `/${category}/tag/${tag}/`,
    index: live,
    follow: true,
  });
}

export default async function TagPage({ params }: { params: Promise<{ category: string; tag: string }> }) {
  const { category, tag } = await params;
  const [meta, cat] = await Promise.all([tagLabel(category, tag), getCategory(category)]);
  if (!cat || !meta) notFound();
  const [site, feed] = await Promise.all([getSite(), getFeed({ categorySlug: category, tag }, 1)]);
  const tags = TAG_PAGES;
  return (
    <ListingPageView
      h1={`${meta.label} ${cat.name}`}
      intro={`${site.name} lists ${cat.name} ads tagged ${meta.label}. ${feed.total} ads match this search.`}
      crumbs={[
        { name: "India", path: "/" },
        { name: cat.name!, path: `/${category}/` },
        { name: meta.label, path: `/${category}/tag/${tag}/` },
      ]}
      path={`/${category}/tag/${tag}/`}
      stars={[]}
      items={feed.items}
      page={1}
      pages={feed.pages}
      total={feed.total}
      noindex={feed.total < 1}
      siblingLinks={tags.filter((item) => item.slug !== tag).slice(0, 8).map((item) => ({ href: `/${category}/tag/${item.slug}/`, label: item.label }))}
      emptyNearby={[]}
      popular={tags.slice(0, 6).map((item) => ({ href: `/${category}/tag/${item.slug}/`, label: item.label }))}
    />
  );
}
