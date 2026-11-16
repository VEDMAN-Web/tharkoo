import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingPageView } from "@/components/ListingPage";
import { FallbackAds } from "@/components/FallbackAds";
import { NewListingPage } from "@/components/new/ListingBand";
import { bandChoice, heroBandFrom } from "@/components/new/band-image";
import { listingLabels } from "@/components/new/listing-frame-props";
import { searchListings, getCategories, getHomepageContent, getLocationBySlug, pageOutOfRange } from "@/lib/queries";
import { postAdPath, searchPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { prettyPlace } from "@/lib/format";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { readShellConfig } from "@/server/site-links/shell-config";
import { FALLBACK_OWN_MINIMUM, loadFallbackSections } from "@/lib/fallback-ads";

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
  searchParams: Promise<{ q?: string; category?: string; location?: string; city?: string; state?: string; photos?: string; verified?: string; page?: string }>;
}) {
  const sp = await searchParams;
  if (sp.page !== undefined && !/^[1-9]\d*$/.test(sp.page)) notFound();
  const city = sp.city || sp.location;
  const state = sp.state || undefined;
  const feed = await searchListings({
    q: sp.q,
    category: sp.category,
    location: city,
    state,
    photos: sp.photos === "1",
    verified: sp.verified === "1",
    page: Number(sp.page) || 1,
  });
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.category) qs.set("category", sp.category);
  if (city) qs.set("city", city);
  if (state) qs.set("state", state);
  if (sp.photos) qs.set("photos", sp.photos);
  if (sp.verified) qs.set("verified", sp.verified);
  const paths = await getPaths();
  const path = `${searchPath(paths)}?${qs.toString()}`;
  if (pageOutOfRange(sp.page, feed.pages)) notFound();
  const [categories, loc, shell, hero, texts] = await Promise.all([
    getCategories(),
    city ? getLocationBySlug(city) : Promise.resolve(null),
    readShellConfig(),
    getHomepageContent().then(heroBandFrom),
    textOverrides(),
  ]);
  const t = makeT(texts);
  const category = categories.find((cat) => cat.slug === sp.category);
  // H7.32 (FIX B): few own results keep their place, and fallback ads go below them. Nothing is empty.
  const own = feed.total < FALLBACK_OWN_MINIMUM;
  const placeName = city ? loc?.name || prettyPlace(city) : prettyPlace(state);
  const fallback = own
    ? await loadFallbackSections({
        scope: {
          categorySlug: category?.slug || undefined,
          categoryName: category?.name || undefined,
          stateSlug: state || loc?.stateSlug || undefined,
          placeName,
        },
        ownSlugs: feed.items.map((ad) => ad.slug || "").filter(Boolean),
      })
    : [];
  const empty = feed.total === 0;
  const lead = empty
    ? {
        text: placeName ? `No ads in ${placeName} yet. Here are ads close by.` : "No ads match your search yet. Here are ads close by.",
        button: placeName ? `Post the first ad in ${placeName}` : "Post an ad",
        href: postAdPath(paths),
      }
    : undefined;
  const pills = sp.q && empty ? categories.slice(0, 6) : [];
  const h1 = sp.q ? `Results for “${sp.q}”` : "Search results";
  const crumbs = [
    { name: "India", path: "/" },
    { name: "Search", path: searchPath(paths) },
  ];
  return (
    <NewListingPage
      tk="search"
      band={{
        crumbs,
        h1,
        intro: sp.q && feed.total === 0 ? "Try another word, or open a popular category." : sp.q ? `Matches for “${sp.q}” across titles, descriptions, categories, and cities.` : "Try a category if nothing matches yet.",
        photo: bandChoice(shell, hero, { category: category?.slug || undefined }),
        categorySlug: category?.slug || undefined,
        citySlug: city || undefined,
        searchAction: searchPath(paths),
        placeholder: "Search ads",
        labels: listingLabels(t),
      }}
    >
      <ListingPageView
        frame
        texts={texts}
        h1={h1}
        locationLabel={sp.q || "Search"}
        crumbs={crumbs}
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
        photos={sp.photos === "1"}
        verified={sp.verified === "1"}
        hideEmpty={empty}
        fallback={
          own ? (
            <>
              {pills.length ? (
                <div className="tk-empty">
                  {pills.map((cat) => (
                    <Link key={cat.slug} href={`/${cat.slug}/`} className="tk-pill" prefetch={false}>
                      {cat.name || cat.slug || "Category"}
                    </Link>
                  ))}
                </div>
              ) : null}
              <FallbackAds sections={fallback} lead={lead} layout="row" />
            </>
          ) : undefined
        }
      />
    </NewListingPage>
  );
}
