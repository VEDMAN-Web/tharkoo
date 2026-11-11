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
import { listingJsonLd } from "@/lib/seo/schema";
import { siteUrl } from "@/lib/utils";
import { listingVisibility } from "@/server/listings/visibility";
import { adPath, categoryPath, placePath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { plain } from "@/lib/plain";
import { getPaths } from "@/server/urls/service";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  await connectDb();
  const record = (await Listing.findOne({ slug }).select("status expiresAt seoNoindex").lean()) as {
    status?: string;
    expiresAt?: Date | null;
    seoNoindex?: boolean;
  } | null;
  const access = listingVisibility(record);
  if (access === "ended") {
    const paths = await getPaths();
    return withUrlSeo(adPath(paths, slug), {
      title: "This listing has ended | Tharkoo",
      description: "This Tharkoo listing has ended and is no longer open for new replies.",
      path: adPath(paths, slug),
      index: false,
    });
  }
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
  const paths = await getPaths();
  const path = adPath(paths, ad.slug || slug);
  return withUrlSeo(path, { title, description, path, image, index: record?.seoNoindex !== true });
}

function listedPrice(attributes: unknown) {
  if (!attributes || typeof attributes !== "object") return null;
  const bag = attributes as Record<string, unknown>;
  for (const key of ["price", "rent", "salary"]) {
    const value = Number(bag[key]);
    if (value > 0) return value;
  }
  return null;
}

function textAttr(attributes: unknown, key: string) {
  if (!attributes || typeof attributes !== "object") return undefined;
  const value = (attributes as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export default async function AdPage({ params }: Props) {
  const { slug } = await params;
  await connectDb();
  const record = (await Listing.findOne({ slug }).select("status expiresAt title description").lean()) as {
    status?: string;
    expiresAt?: Date | null;
    title?: string;
    description?: string;
  } | null;
  const access = listingVisibility(record);
  if (access === "gone" || access === "missing") notFound();
  if (access === "ended") {
    const paths = await getPaths();
    const publicAd = adPath(paths, slug);
    return (
      <article className="tk-container" style={{ paddingTop: 16, paddingBottom: 24 }}>
        <h1>{displayTitle(record?.title) || "Listing"}</h1>
        <p role="status">This listing has ended.</p>
        {record?.description ? <p>{record.description}</p> : null}
        <JsonLd data={breadcrumbJsonLd([{ name: "Tharkoo India", path: "/" }, { name: displayTitle(record?.title) || "Listing", path: publicAd }])} />
      </article>
    );
  }
  const ad = await getListingBySlug(slug);
  if (!ad) notFound();
  const row = (await Listing.findOne({ slug: ad.slug }).select("_id attributes publishedAt expiresAt").lean()) as {
    _id?: unknown;
    attributes?: unknown;
    publishedAt?: Date;
    expiresAt?: Date;
  } | null;
  const listingId = row?._id ? String(row._id) : undefined;
  const [cat, related] = await Promise.all([getCategory(ad.categorySlug || ""), getRelated(ad, 6)]);
  const cover = safePhoto(ad.photos?.[0]);
  const paths = await getPaths();
  const publicAd = adPath(paths, ad.slug || slug);
  const shareUrl = canonical(publicAd);
  const heading = await urlHeading(publicAd, displayTitle(ad.title) || "Listing");
  const image = cover ? (cover.startsWith("http") ? cover : `${siteUrl().replace(/\/$/, "")}${cover}`) : undefined;
  const city = prettyPlace(ad.citySlug);
  const catName = cat?.name || ad.categorySlug || "";
  const state = prettyPlace(ad.stateSlug);
  const district = prettyPlace(ad.districtSlug);
  const crumbs = [
    { name: "Tharkoo India", path: "/" },
    { name: catName, path: categoryPath(ad.categorySlug || "") },
    ...(state ? [{ name: `${state} ${catName}`, path: placePath(ad.categorySlug || "", ad.stateSlug || "") }] : []),
    { name: `${city} ${catName}`, path: placePath(ad.categorySlug || "", ad.citySlug || "") },
    ...(district ? [{ name: `${district} ${catName}`, path: placePath(ad.categorySlug || "", ad.citySlug || "", ad.districtSlug || "") }] : []),
  ];
  const structured = listingJsonLd({
    category: ad.categorySlug || "",
    name: displayTitle(ad.title),
    description: (ad.description || displayTitle(ad.title)).slice(0, 300),
    url: shareUrl,
    image,
    city,
    price: listedPrice(row?.attributes),
    datePosted: row?.publishedAt ? new Date(row.publishedAt).toISOString() : undefined,
    validThrough: row?.expiresAt ? new Date(row.expiresAt).toISOString() : undefined,
    hiringOrganization: textAttr(row?.attributes, "company") || textAttr(row?.attributes, "hiringOrganization"),
    jobLocation: city || undefined,
  });
  return (
    <>
      <JsonLd data={structured ? [breadcrumbJsonLd(crumbs), structured] : [breadcrumbJsonLd(crumbs)]} />
      <AdDetail ad={plain(ad)} categoryName={catName} related={plain(related)} listingId={listingId} crumbs={crumbs} shareUrl={shareUrl} heading={heading} />
    </>
  );
}
