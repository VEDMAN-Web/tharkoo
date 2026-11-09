import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdDetail } from "@/components/AdDetail";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { prettyPlace } from "@/lib/format";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { getCategory, getListingBySlug, getSite } from "@/lib/queries";
import { canonical, fillTemplate } from "@/lib/seo";
import { plain } from "@/lib/plain";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [ad, site] = await Promise.all([getListingBySlug(slug), getSite()]);
  if (!ad) return {};
  return {
    title: fillTemplate("{title} — {city} | {site}", {
      title: ad.title,
      city: ad.citySlug,
      site: site.name,
    }),
    description: ad.description?.slice(0, 160),
    alternates: { canonical: canonical(`/ad/${ad.slug}/`) },
  };
}

export default async function AdPage({ params }: Props) {
  const { slug } = await params;
  const ad = await getListingBySlug(slug);
  if (!ad) notFound();
  const cat = await getCategory(ad.categorySlug || "");
  const city = prettyPlace(ad.citySlug);
  const catName = cat?.name || ad.categorySlug || "";
  const crumbs = [
    { name: "India", path: "/" },
    { name: catName, path: `/${ad.categorySlug}/` },
    { name: city, path: `/${ad.categorySlug}/${ad.citySlug}/` },
    { name: ad.title || "", path: `/ad/${ad.slug}/` },
  ];
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "Offer",
            name: ad.title,
            url: canonical(`/ad/${ad.slug}/`),
            availability: "https://schema.org/InStock",
          },
        ]}
      />
      <div className="sk-container">
        <Breadcrumbs crumbs={crumbs.slice(0, 3)} backHref={`/${ad.categorySlug}/${ad.citySlug}/`} />
      </div>
      <AdDetail ad={plain(ad)} categoryName={catName} />
    </>
  );
}
