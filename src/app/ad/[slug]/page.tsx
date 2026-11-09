import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { AdCard } from "@/components/AdCard";
import { AdDetail } from "@/components/AdDetail";
import { prettyPlace } from "@/lib/format";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { getCategory, getListingBySlug, getRelated, getSite } from "@/lib/queries";
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
  const [cat, related, site] = await Promise.all([
    getCategory(ad.categorySlug || ""),
    getRelated(ad),
    getSite(),
  ]);
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "India", path: "/" },
            { name: cat?.name || ad.categorySlug || "", path: `/${ad.categorySlug}/` },
            { name: prettyPlace(ad.citySlug) || "", path: `/${ad.categorySlug}/${ad.citySlug}/` },
            { name: ad.title || "", path: `/ad/${ad.slug}/` },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Offer",
            name: ad.title,
            url: canonical(`/ad/${ad.slug}/`),
            availability: "https://schema.org/InStock",
          },
        ]}
      />
      <nav className="mb-2 text-[12px] text-[#888]">
        <Link href="/">India</Link>
        {" › "}
        <Link href={`/${ad.categorySlug}/`}>{cat?.name || ad.categorySlug}</Link>
        {" › "}
        <Link href={`/${ad.categorySlug}/${ad.citySlug}/`}>{prettyPlace(ad.citySlug)}</Link>
      </nav>
      <AdDetail ad={plain(ad)} categoryName={cat?.name || ad.categorySlug || ""} />
      <p className="mt-6 text-[12px] text-[#777]">
        If you detect inappropriate, illegal content or misuse of data, report it through Submit a report.
        {site.legalName ? ` Operated by ${site.legalName}.` : ""}
      </p>
      {related.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-[16px] font-bold">Related ads</h2>
          <div className="ad-list overflow-hidden">
            {related.map((item) => (
              <AdCard key={item.publicId} ad={item} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
