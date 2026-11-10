import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdDetail } from "@/components/AdDetail";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { prettyPlace, displayTitle } from "@/lib/format";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { connectDb } from "@/lib/db";
import { Listing } from "@/lib/models";
import { safePhoto } from "@/lib/media";
import { getCategory, getListingBySlug, getRelated, getSite } from "@/lib/queries";
import { canonical, fillTemplate } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";
import { plain } from "@/lib/plain";

type Props = { params: Promise<{ slug: string }> };

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
  const city = prettyPlace(ad.citySlug);
  const catName = cat?.name || ad.categorySlug || "";
  const crumbs = [
    { name: "India", path: "/" },
    { name: catName, path: `/${ad.categorySlug}/` },
    { name: city, path: `/${ad.categorySlug}/${ad.citySlug}/` },
    { name: displayTitle(ad.title) || "Ad", path: `/ad/${ad.slug}/` },
  ];
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "Offer",
            name: displayTitle(ad.title),
            url: canonical(`/ad/${ad.slug}/`),
            availability: "https://schema.org/InStock",
          },
        ]}
      />
      <Container className="pt-6">
        <Breadcrumbs crumbs={crumbs} />
      </Container>
      <AdDetail ad={plain(ad)} categoryName={catName} related={plain(related)} listingId={listingId} />
    </>
  );
}
