import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdDetail } from "@/components/AdDetail";
import { prettyPlace, displayTitle } from "@/lib/format";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { connectDb } from "@/lib/db";
import { Listing } from "@/lib/models";
import { safePhoto } from "@/lib/media";
import { getCategory, getListingBySlug, getRelated, getSite } from "@/lib/queries";
import { canonical, fillTemplate } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";
import { pageMetadata } from "@/lib/ui/meta";
import { plain } from "@/lib/plain";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [ad, site] = await Promise.all([getListingBySlug(slug), getSite()]);
  if (!ad) return {};
  const title = fillTemplate("{title} — {city} {category} | {site}", {
    title: displayTitle(ad.title),
    city: prettyPlace(ad.citySlug),
    category: ad.categorySlug,
    site: site.name,
  });
  const description = (ad.description || title).slice(0, 160);
  const image = safePhoto(ad.photos?.[0]) || "/brand/og-default.png";
  return pageMetadata({ title, description, path: `/ad/${ad.slug}/`, image });
}

export default async function AdPage({ params }: Props) {
  const { slug } = await params;
  const ad = await getListingBySlug(slug);
  if (!ad) notFound();
  await connectDb();
  const row = await Listing.findOne({ slug: ad.slug }).select("_id").lean();
  const listingId = row?._id ? String(row._id) : undefined;
  const [cat, related] = await Promise.all([getCategory(ad.categorySlug || ""), getRelated(ad, 6)]);
  const cover = safePhoto(ad.photos?.[0]);
  const shareUrl = canonical(`/ad/${ad.slug}/`);
  const image = cover ? (cover.startsWith("http") ? cover : `${siteUrl().replace(/\/$/, "")}${cover}`) : undefined;
  const city = prettyPlace(ad.citySlug);
  const catName = cat?.name || ad.categorySlug || "";
  const state = prettyPlace(ad.stateSlug);
  const district = prettyPlace(ad.districtSlug);
  const crumbs = [
    { name: "Tharkoo India", path: "/" },
    { name: catName, path: `/${ad.categorySlug}/` },
    ...(state ? [{ name: `${state} ${catName}`, path: `/${ad.categorySlug}/${ad.stateSlug}/` }] : []),
    { name: `${city} ${catName}`, path: `/${ad.categorySlug}/${ad.citySlug}/` },
    ...(district ? [{ name: `${district} ${catName}`, path: `/${ad.categorySlug}/${ad.citySlug}/${ad.districtSlug}/` }] : []),
  ];
  return (
    <>
      {cover ? <link rel="preload" as="image" href={cover} fetchPriority="high" /> : null}
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: displayTitle(ad.title),
            description: (ad.description || displayTitle(ad.title)).slice(0, 300),
            url: shareUrl,
            ...(image ? { image: [image] } : {}),
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "INR",
              availability: "https://schema.org/InStock",
              url: shareUrl,
              seller: { "@type": "Person", name: ad.displayName || "Tharkoo member" },
            },
          },
        ]}
      />
      <AdDetail ad={plain(ad)} categoryName={catName} related={plain(related)} listingId={listingId} crumbs={crumbs} shareUrl={shareUrl} />
    </>
  );
}
