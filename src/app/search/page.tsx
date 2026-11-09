import type { Metadata } from "next";
import { ListingPageView } from "@/components/ListingPage";
import { searchListings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; location?: string; photos?: string; verified?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const feed = await searchListings({
    q: sp.q,
    category: sp.category,
    location: sp.location,
    photos: sp.photos === "1",
    verified: sp.verified === "1",
    page: Number(sp.page) || 1,
  });
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>,
  );
  qs.delete("page");
  const path = `/search?${qs.toString()}`;
  return (
    <ListingPageView
      h1={sp.q ? `Results for “${sp.q}”` : "Search results"}
      intro="Search pages are noindex. Use a category + city URL when you want Google to find the page."
      crumbs={[
        { name: "India", path: "/" },
        { name: "Search", path: "/search" },
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
      photos={sp.photos === "1"}
      verified={sp.verified === "1"}
    />
  );
}
