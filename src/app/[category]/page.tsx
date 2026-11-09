import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPageView } from "@/components/ListingPage";
import {
  getCategory,
  getCities,
  getFeed,
  getSeo,
  getSite,
  getStarListings,
  isThin,
} from "@/lib/queries";
import { canonical, fillTemplate } from "@/lib/seo";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const [cat, seo, site] = await Promise.all([getCategory(category), getSeo("category"), getSite()]);
  if (!cat) return {};
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };
  return {
    title: fillTemplate(seo?.title || "{category} | Tharkoo", vars),
    description: fillTemplate(seo?.description || "", vars),
    alternates: { canonical: canonical(`/${category}/`) },
  };
}

export default async function CategoryHub({ params, searchParams }: Props) {
  const { category } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const cat = await getCategory(category);
  if (!cat) notFound();
  const [seo, site, cities, stars, feed] = await Promise.all([
    getSeo("category"),
    getSite(),
    getCities(),
    getStarListings({ categorySlug: category }),
    getFeed({ categorySlug: category }, page),
  ]);
  const vars = { category: cat.name, site: site.name, count: feed.total, year: new Date().getFullYear() };
  return (
    <ListingPageView
      h1={fillTemplate(seo?.h1 || "{category} in India", vars)}
      h2={fillTemplate(seo?.h2 || "", vars)}
      intro={fillTemplate(seo?.intro || "", vars)}
      footer={fillTemplate(seo?.footer || "", vars)}
      crumbs={[
        { name: "India", path: "/" },
        { name: cat.name!, path: `/${category}/` },
      ]}
      path={`/${category}/`}
      stars={stars}
      items={feed.items}
      page={feed.page}
      pages={feed.pages}
      total={feed.total}
      noindex={isThin(feed.total)}
      siblingLinks={cities.slice(0, 24).map((c) => ({ href: `/${category}/${c.slug}/`, label: c.name! }))}
      emptyNearby={[]}
    />
  );
}
