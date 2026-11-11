import { notFound } from "next/navigation";
import { ListingPageView } from "@/components/ListingPage";
import { searchListings, getCategories, pageOutOfRange } from "@/lib/queries";
import { searchPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(searchPath(paths), {
    title: "Search classifieds | Tharkoo",
    description: "Search Tharkoo listings by keyword, category, and city.",
    path: searchPath(paths),
    index: false,
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; location?: string; city?: string; photos?: string; verified?: string; page?: string }>;
}) {
  const sp = await searchParams;
  if (sp.page !== undefined && !/^[1-9]\d*$/.test(sp.page)) notFound();
  const city = sp.city || sp.location;
  const feed = await searchListings({
    q: sp.q,
    category: sp.category,
    location: city,
    photos: sp.photos === "1",
    verified: sp.verified === "1",
    page: Number(sp.page) || 1,
  });
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.category) qs.set("category", sp.category);
  if (city) qs.set("city", city);
  if (sp.photos) qs.set("photos", sp.photos);
  if (sp.verified) qs.set("verified", sp.verified);
  const paths = await getPaths();
  const path = `${searchPath(paths)}?${qs.toString()}`;
  if (pageOutOfRange(sp.page, feed.pages)) notFound();
  const categories = await getCategories();
  return (
    <ListingPageView
      h1={sp.q ? `Results for “${sp.q}”` : "Search results"}
      locationLabel={sp.q || "Search"}
      intro={
        sp.q && feed.total === 0
          ? "Try another word, or open a popular category."
          : sp.q
            ? `Matches for “${sp.q}” across titles, descriptions, categories, and cities.`
            : "Try a category if nothing matches yet."
      }
      crumbs={[
        { name: "India", path: "/" },
        { name: "Search", path: searchPath(paths) },
      ]}
      path={path}
      stars={[]}
      items={feed.items}
      page={feed.page}
      pages={feed.pages}
      total={feed.total}
      noindex
      siblingLinks={[]}
      emptyNearby={[]}
      query={sp.q || ""}
      suggestions={categories.slice(0, 6).map((cat) => ({ href: `/${cat.slug}/`, label: cat.name || cat.slug || "Category" }))}
      photos={sp.photos === "1"}
      verified={sp.verified === "1"}
    />
  );
}
