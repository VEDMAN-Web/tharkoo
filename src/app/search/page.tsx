import { ListingPageView } from "@/components/ListingPage";
import { searchListings, getCategories } from "@/lib/queries";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Search classifieds | Tharkoo",
  description: "Search Tharkoo listings by keyword, category, and city.",
  path: "/search/",
  index: false,
});

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; location?: string; city?: string; photos?: string; verified?: string; page?: string }>;
}) {
  const sp = await searchParams;
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
  const path = `/search/?${qs.toString()}`;
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
        { name: "Search", path: "/search/" },
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
