import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdCard } from "@/components/AdCard";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { getCategory, getListingBySlug, getRelated, getSite } from "@/lib/queries";
import { canonical, fillTemplate } from "@/lib/seo";

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
  const letter = (ad.displayName || "?").slice(0, 1);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "India", path: "/" },
            { name: cat?.name || ad.categorySlug || "", path: `/${ad.categorySlug}/` },
            { name: ad.citySlug || "", path: `/${ad.categorySlug}/${ad.citySlug}/` },
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
      <p className="text-[12px] uppercase tracking-wide text-[#888]">
        {ad.publishedAt ? new Date(ad.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : ""}{" "}
        - Ad ID: {ad.publicId}
      </p>
      <h1 className="mt-2 text-[22px] font-bold leading-snug text-[#222]">{ad.title}</h1>
      <p className="mt-2 text-[14px]">
        <strong>{ad.displayName}</strong>
      </p>
      <p className="text-[13px] text-[#666]">
        {ad.age} years {ad.citySlug}
        {ad.place ? ` / ${ad.place}` : ""}
      </p>
      {ad.photos?.length ? (
        <div className="mt-4 grid h-56 place-items-center bg-[#ddd] text-6xl font-bold text-[#888]">
          {letter}
        </div>
      ) : null}
      <h2 className="mt-6 text-[16px] font-bold">About me</h2>
      <p className="mt-2 max-w-3xl whitespace-pre-wrap text-[14px] leading-6">{ad.description}</p>
      <dl className="mt-4 grid max-w-md grid-cols-2 gap-2 text-sm">
        <dt className="text-[var(--text-secondary)]">Category</dt>
        <dd>{cat?.name}</dd>
        <dt className="text-[var(--text-secondary)]">City</dt>
        <dd>{ad.citySlug}</dd>
        {ad.verified ? (
          <>
            <dt className="text-[var(--text-secondary)]">Status</dt>
            <dd>Verified</dd>
          </>
        ) : null}
      </dl>
      <h2 className="mt-6 text-[16px] font-bold">Contact me</h2>
      <div className="mt-3 flex max-w-md flex-col gap-2">
        {ad.phone ? (
          <a className="block rounded-sm bg-[var(--sk-call)] px-4 py-3 text-center text-sm font-bold text-white no-underline" href={`tel:${ad.phone}`}>
            Call
          </a>
        ) : null}
        {ad.whatsapp ? (
          <a className="block rounded-sm bg-[var(--sk-wa)] px-4 py-3 text-center text-sm font-bold text-white no-underline" href={`https://wa.me/91${ad.whatsapp}`}>
            WhatsApp
          </a>
        ) : null}
        {ad.telegram ? (
          <a className="block rounded-sm bg-[var(--sk-tg)] px-4 py-3 text-center text-sm font-bold text-white no-underline" href={`https://t.me/${ad.telegram}`}>
            Telegram
          </a>
        ) : null}
      </div>
      <div className="mt-4 flex gap-4 text-[13px]">
        <button className="underline" type="button">
          Save contact
        </button>
        <Link href="/submit-report">Report this ad</Link>
      </div>
      <p className="mt-6 text-[12px] text-[#777]">
        If you detect inappropriate, illegal content or misuse of data, report it through Submit a report.
        {site.legalName ? ` Operated by ${site.legalName}.` : ""}
      </p>
      {related.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-[16px] font-bold">Related ads</h2>
          <div className="overflow-hidden border border-[#e0e0e0] bg-white">
            {related.map((item) => (
              <AdCard key={item.publicId} ad={item} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
