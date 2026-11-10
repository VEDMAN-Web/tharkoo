import { notFound } from "next/navigation";
import { ListingPageView } from "@/components/ListingPage";
import { TAG_PAGES } from "@/data/catalog";
import { getCategory, getFeed, getSite } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TagPage({ params }: { params: Promise<{ category: string; tag: string }> }) {
  const { category, tag } = await params;
  const meta = TAG_PAGES.find((t) => t.slug === tag);
  const cat = await getCategory(category);
  if (!cat || !meta) notFound();
  const [site, feed] = await Promise.all([getSite(), getFeed({ categorySlug: category }, 1)]);
  return (
    <ListingPageView
      h1={`${cat.name} — ${meta.label}`}
      intro={`Browse ${cat.name} ads tagged ${meta.label}. ${site.name} is a classifieds board. Tag labels can be edited in the catalogue.`}
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
      siblingLinks={TAG_PAGES.map((t) => ({ href: `/${category}/tag/${t.slug}/`, label: t.label }))}
      emptyNearby={[]}
    />
  );
}
