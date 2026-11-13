import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getCategory, getCities, getFeed, getSeoFor, getSite, getStarListings, getStates, listingCountsByCategoryCity } from "@/lib/queries";
import { getPaths } from "@/server/urls/service";
import { adPath, categoryPath, placePath } from "@/lib/urls";
import { fillTemplate } from "@/lib/seo";
import { getIndexing, isCategoryOn } from "@/server/seo/indexing";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { faqPage, itemListNode } from "@/lib/seo/schema";
import { canonical } from "@/lib/seo";
import { AdCard, UiTextProvider } from "@/components/ui/AdCard";
import { textOverrides } from "@/app/admin/ui-text/store";
import { makeT, pickTexts } from "@/lib/ui/text";
import { resolveListingLayout } from "@/components/blocks/ListingLayout";
import { deviceClass } from "@/components/blocks/device";
import { listingHeading } from "@/lib/layout/listing";
import { hourSeed, orderFeed } from "@/components/feedOrder";
import { fallbackLanding, mergeLanding, type LandingCopy } from "@/lib/seo/landing";
import { SubcategoryChips } from "./SubcategoryChips";

type Props = { params: Promise<{ category: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const [cat, seo, site] = await Promise.all([getCategory(category), getSeoFor("category", category), getSite()]);
  if (!cat) return {};
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };
  const title = fillTemplate(seo?.title || "{category} classifieds across India | Tharkoo", vars);
  const description = fillTemplate(seo?.description || "Browse {category} on Tharkoo: listings from people across Indian cities. Filter by city and district, see photos and contact posters directly.", vars);
  const path = categoryPath(cat.slug || category);
  const on = isCategoryOn(await getIndexing(), cat.slug || category);
  return withUrlSeo(path, { title, description, path, index: on });
}

export default async function CategoryHub({ params }: Props) {
  const { category } = await params;
  const cat = await getCategory(category);
  if (!cat) notFound();
  if (cat.slug && cat.slug !== category) permanentRedirect(categoryPath(cat.slug));
  const [seo, site, cities, states, counts, feed, stars, paths, heading] = await Promise.all([
    getSeoFor("category", category),
    getSite(),
    getCities(),
    getStates(),
    listingCountsByCategoryCity().catch(() => []),
    getFeed({ categorySlug: category }, 1),
    getStarListings({ categorySlug: category }).catch(() => []),
    getPaths(),
    urlHeading(categoryPath(cat.slug || category), `${cat.name} in India`),
  ]);
  const texts = await textOverrides();
  const t = makeT(texts);
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };
  const copy = mergeLanding(
    fallbackLanding({ category: cat.name || category, count: feed.total, site: site.name }),
    (site as { landings?: Record<string, Partial<LandingCopy>> }).landings?.[`${category}|india`],
  );
  const allowed = new Set(counts.filter((row) => row._id.categorySlug === category && row.n > 0).map((row) => row._id.citySlug));
  const listed = allowed.size ? cities.filter((city) => allowed.has(city.slug || "")) : cities;
  const ads = [
    ...stars,
    ...orderFeed(feed.items.filter((ad) => !stars.some((star) => star.slug && star.slug === ad.slug)), hourSeed()),
  ];
  const layout = await resolveListingLayout({ path: categoryPath(cat.slug || category), category: cat.slug || category, vars: { ...vars, count: feed.total } });
  const headerBlock = layout.blocks.find((block) => block.type === "listingHeader");
  const h1Text = listingHeading(String(headerBlock?.props.h1Template ?? ""), heading, { ...layout.vars, h1: heading });
  const wrap = (id: string, devices: Parameters<typeof deviceClass>[0], content: React.ReactNode) => {
    const cls = deviceClass(devices);
    return cls ? <div key={id} className={cls}>{content}</div> : <span key={id} style={{ display: "contents" }}>{content}</span>;
  };
  const feedAndText = (
    <>
      <div className="tk-feed" data-tk="category-feed">
        {ads.map((ad, index) => (
          <AdCard key={ad.publicId || ad.slug || index} ad={ad} featured={index < stars.length} priority={index === 0} />
        ))}
      </div>
      <section className="tk-browse-city" data-tk="browse-by-city">
        <h2>{t("listing.hub.browseByCity")}</h2>
        <div className="tk-pills tk-pills-left">
          {states.flatMap((state) =>
            listed
              .filter((city) => city.stateSlug === state.slug)
              .map((city) => (
                <Link key={city.slug} href={placePath(cat.slug || category, city.slug || "")} className="tk-pill" prefetch={false}>
                  {city.name}
                </Link>
              )),
          )}
        </div>
      </section>
      <p className="tk-seo-foot">{copy.intro || fillTemplate(seo?.intro || "", vars)}</p>
      {copy.faqs.map((item) => (
        <p key={item.q} className="tk-seo-foot">
          <strong>{item.q}</strong> {item.a}
        </p>
      ))}
    </>
  );
  const inFeedId = String(layout.blocks.find((block) => block.type === "listingFeed")?.props.inFeedBlockId ?? "");

  return (
    <UiTextProvider texts={pickTexts(texts, "card.")}>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: t("listing.crumb.home"), path: "/" },
            { name: cat.name || category, path: categoryPath(cat.slug || category) },
          ]),
          itemListNode({
            url: canonical(categoryPath(cat.slug || category)),
            total: feed.total,
            items: ads.slice(0, 12).map((ad, index) => ({
              url: canonical(adPath(paths, ad.slug || "")),
              name: ad.title || "Ad",
              position: index + 1,
            })),
          }),
          faqPage(copy.faqs),
        ]}
      />
      <div className="tk-banner">
        <div className="tk-container">
          <h1>{h1Text}</h1>
        </div>
        <MapPin className="tk-banner-pins tk-icon-lg" size={180} color="#fff" aria-hidden />
      </div>
      <div className="tk-container" style={{ paddingBottom: 32 }}>
        <Breadcrumbs crumbs={[{ name: t("listing.crumb.home"), path: "/" }, { name: cat.name!, path: categoryPath(cat.slug || category) }]} />
        {/* Blocks in the order the layout gives. The category page draws the ads and the SEO text itself (the ads come with the text below them);
            filters, nearby cities and similar link blocks belong to city pages and are skipped here. */}
        {layout.blocks.map((block) => {
          if (block.type === "listingFeed") return wrap(block.id, block.devices, feedAndText);
          if (["listingHeader", "filters", "relatedCategories", "nearbyCities", "districtLinks"].includes(block.type)) return null;
          return block.id === inFeedId ? null : wrap(block.id, block.devices, layout.nodes[block.id] ?? null);
        })}
      </div>
      <SubcategoryChips category={cat.slug || category} heading={t("listing.hub.browseBySub")} />
    </UiTextProvider>
  );
}
