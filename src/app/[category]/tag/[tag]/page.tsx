import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPageView } from "@/components/ListingPage";
import { getCategory, getFeed, getSite } from "@/lib/queries";
import { tagPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths, publicTags } from "@/server/urls/service";

export const revalidate = 300;

async function tagLabel(tag: string) {
  const tags = await publicTags();
  return tags.find((item) => item.slug === tag) || null;
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; tag: string }> }): Promise<Metadata> {
  const { category, tag } = await params;
  const [meta, cat, feed, paths] = await Promise.all([tagLabel(tag), getCategory(category), getFeed({ categorySlug: category, tag }, 1), getPaths()]);
  const path = tagPath(paths, cat?.slug || category, tag);
  if (!cat || !meta) {
    return withUrlSeo(path, {
      title: "Page not found | Tharkoo",
      description: "That tag page is not on Tharkoo. Browse a category from the home page instead.",
      path,
      index: false,
      follow: false,
    });
  }
  const live = feed.total >= 1;
  return withUrlSeo(path, {
    title: `${meta.label} ${cat.name} ads | Tharkoo`,
    description: `Browse ${cat.name} ads tagged ${meta.label} on Tharkoo. Open a listing to see the details, photos, and how to get in touch.`,
    path,
    index: live,
    follow: true,
  });
}

export default async function TagPage({ params }: { params: Promise<{ category: string; tag: string }> }) {
  const { category, tag } = await params;
  const [meta, cat, paths] = await Promise.all([tagLabel(tag), getCategory(category), getPaths()]);
  if (!cat || !meta) notFound();
  const path = tagPath(paths, cat.slug || category, tag);
  const [site, feed, tags, heading] = await Promise.all([getSite(), getFeed({ categorySlug: category, tag }, 1), publicTags(), urlHeading(path, `${meta.label} ${cat.name}`)]);
  return (
    <ListingPageView
      h1={heading}
      intro={`${site.name} lists ${cat.name} ads tagged ${meta.label}. ${feed.total} ads match this search.`}
      crumbs={[
        { name: "India", path: "/" },
        { name: cat.name!, path: `/${cat.slug}/` },
        { name: meta.label, path },
      ]}
      path={path}
      stars={[]}
      items={feed.items}
      page={1}
      pages={feed.pages}
      total={feed.total}
      noindex={feed.total < 1}
      siblingLinks={tags.filter((item) => item.slug !== tag).slice(0, 8).map((item) => ({ href: tagPath(paths, cat.slug || category, item.slug), label: item.label }))}
      emptyNearby={[]}
      popular={tags.slice(0, 6).map((item) => ({ href: tagPath(paths, cat.slug || category, item.slug), label: item.label }))}
    />
  );
}
