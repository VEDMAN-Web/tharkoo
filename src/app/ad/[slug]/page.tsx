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
      <p className="text-sm text-[var(--text-secondary)]">
        {ad.publishedAt ? new Date(ad.publishedAt).toLocaleDateString("en-IN", { dateStyle: "long" }) : ""}{" "}
        · Ad ID: {ad.publicId}
      </p>
      <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{ad.title}</h1>
      <p className="mt-1 text-sm">
        {ad.displayName} · {ad.age} years · {ad.citySlug}
        {ad.place ? ` / ${ad.place}` : ""}
      </p>
      {ad.photos?.length ? (
        <div className="mt-4 grid h-56 place-items-center rounded bg-[var(--brand-primary)] text-6xl font-semibold text-white">
          {letter}
        </div>
      ) : null}
      <h2 className="mt-6 text-lg font-semibold">About</h2>
      <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6">{ad.description}</p>
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
      <h2 className="mt-6 text-lg font-semibold">Contact</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {ad.phone ? (
          <a className="rounded bg-[var(--contact-call)] px-4 py-2 text-sm font-semibold text-white hover:text-white" href={`tel:${ad.phone}`}>
            Call
          </a>
        ) : null}
        {ad.whatsapp ? (
          <a className="rounded bg-[var(--contact-wa)] px-4 py-2 text-sm font-semibold text-white hover:text-white" href={`https://wa.me/91${ad.whatsapp}`}>
            WhatsApp
          </a>
        ) : null}
        {ad.telegram ? (
          <a className="rounded bg-[var(--contact-tg)] px-4 py-2 text-sm font-semibold text-white hover:text-white" href={`https://t.me/${ad.telegram}`}>
            Telegram
          </a>
        ) : null}
        {ad.emailOn ? (
          <span className="rounded bg-[var(--contact-email)] px-4 py-2 text-sm font-semibold text-white">
            Email (relay in a later slice)
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        <button className="underline" type="button">
          Save contact (login in slice 2)
        </button>
        <Link href="/submit-report">Report this ad</Link>
      </div>
      <aside className="mt-6 rounded border bg-amber-50 p-4 text-sm">
        Safety: Tharkoo staff will never ask you to pay outside the wallet.{" "}
        <Link href="/help#scams" className="underline">
          How to report a scam
        </Link>
        . {site.name} is operated by {site.legalName}.
      </aside>
      {related.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Related ads</h2>
          <div className="grid gap-3">
            {related.map((item) => (
              <AdCard key={item.publicId} ad={item} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
