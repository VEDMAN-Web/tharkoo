import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPageView } from "@/components/ListingPage";
import { NewListingPage } from "@/components/new/ListingBand";
import { bandChoice, heroBandFrom } from "@/components/new/band-image";
import { listingLabels } from "@/components/new/listing-frame-props";
import { FallbackAds } from "@/components/FallbackAds";
import { getCategory, getFeed, getHomepageContent, getSite } from "@/lib/queries";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { readShellConfig } from "@/server/site-links/shell-config";
import { FALLBACK_OWN_MINIMUM, loadFallbackSections } from "@/lib/fallback-ads";
import { postAdPath, searchPath, tagPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths, publicTags } from "@/server/urls/service";

export const revalidate = 300;

async function tagLabel(tag: string) {
  const tags = await publicTags();
  return tags.find((item) => item.slug === tag) || null;
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; tag: string }> }): Promise<Metadata> {
  const { category, tag } = await params;
  const [meta, cat, paths] = await Promise.all([tagLabel(tag), getCategory(category), getPaths()]);
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
  // Tag pages are not one of the three indexable listing types (see filter-seo.ts).
  return withUrlSeo(path, {
    title: `${meta.label} ${cat.name} ads | Tharkoo`,
    description: `Browse ${cat.name} ads tagged ${meta.label} on Tharkoo. Open a listing to see the details, photos, and how to get in touch.`,
    path,
    index: false,
    follow: true,
  });
}

export default async function TagPage({ params }: { params: Promise<{ category: string; tag: string }> }) {
  const { category, tag } = await params;
  const [meta, cat, paths] = await Promise.all([tagLabel(tag), getCategory(category), getPaths()]);
  if (!cat || !meta) notFound();
  const path = tagPath(paths, cat.slug || category, tag);
  const [site, feed, tags, heading, shell, hero, texts] = await Promise.all([
    getSite(),
    getFeed({ categorySlug: category, tag }, 1),
    publicTags(),
    urlHeading(path, `${meta.label} ${cat.name}`),
    readShellConfig(),
    getHomepageContent().then(heroBandFrom),
    textOverrides(),
  ]);
  const t = makeT(texts);
  const own = feed.total < FALLBACK_OWN_MINIMUM;
  const fallback = own
    ? await loadFallbackSections({
        scope: { categorySlug: cat.slug || category, categoryName: cat.name || undefined },
        ownSlugs: feed.items.map((ad) => ad.slug || "").filter(Boolean),
      })
    : [];
  const crumbs = [
    { name: "India", path: "/" },
    { name: cat.name!, path: `/${cat.slug}/` },
    { name: meta.label, path },
  ];
  const lead =
    feed.total === 0
      ? { text: `No ${meta.label} ${cat.name} ads yet. Here are ads close by.`, button: `Post the first ad in ${cat.name}`, href: postAdPath(paths) }
      : undefined;
  return (
    <NewListingPage
      tk="tag"
      band={{
        crumbs,
        h1: heading,
        intro: `${site.name} lists ${cat.name} ads tagged ${meta.label}. ${feed.total} ads match this search.`,
        photo: bandChoice(shell, hero, { category: cat.slug || category }),
        categorySlug: cat.slug || category,
        searchAction: searchPath(paths),
        placeholder: `Search ${cat.name} ads`,
        labels: listingLabels(t),
      }}
    >
      <ListingPageView
        frame
        texts={texts}
        h1={heading}
        crumbs={crumbs}
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
        hideEmpty={feed.total === 0}
        fallback={own ? <FallbackAds sections={fallback} lead={lead} layout="row" /> : undefined}
      />
    </NewListingPage>
  );
}
