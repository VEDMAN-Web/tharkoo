import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdDetail } from "@/components/AdDetail";
import { NewAdDetail } from "@/components/new/NewAdDetail";
import { newDesignOn } from "@/server/site-links/new-design";
import "./ad-perf.css";
import { AdCountsBar } from "./AdCountsBar";
import { AdVideos } from "@/components/ad/AdVideos";
import { listAdVideos } from "@/server/media/video";
import { prettyPlace, displayTitle } from "@/lib/format";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { connectDb } from "@/lib/db";
import { Listing } from "@/lib/models";
import { safePhoto } from "@/lib/media";
import { getCategory, getListingBySlug, getRelated, getSite } from "@/lib/queries";
import { canonical, fillTemplate } from "@/lib/seo";
import { adJsonLdNodes } from "@/lib/seo/schema";
import { adMetaDescription } from "@/lib/seo/ad-description";
import { getSeoSettings } from "@/app/admin/seo/settings/store";
import { siteUrl } from "@/lib/utils";
import { listingVisibility } from "@/server/listings/visibility";
import { loadEndedAd } from "@/server/listings/ended-ad";
import { AdEnded } from "@/components/AdEnded";
import { adDescriptionFromText, adPageTitle, adRobots } from "@/lib/seo/ad-seo";
import { isSampleListing } from "@/server/listings/demo-ads";
import { adPath, categoryPath, placePath } from "@/lib/urls";
import { adAddress } from "@/lib/ad-address";
import { addressForSlug } from "@/server/listings/ad-route";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { plain } from "@/lib/plain";
import { isCityAlias } from "@/lib/seo/district-alias";
import { publicSellerName } from "@/lib/seller-name";
import { getPaths } from "@/server/urls/service";
import { videoTourOffer } from "@/server/tours/offer";
import { listingIsPeople } from "@/server/availability/people";
import { coinProviderName } from "@/server/wallet/provider";
import { textOverrides } from "@/app/admin/ui-text/store";
import { pickTexts } from "@/lib/ui/text";
import { popupAlternatives } from "@/components/new/NewAdDetail";
import { adDetailRows, interestsOf } from "@/lib/ad-details";
import { User } from "@/server/models";
import { kindFeatures } from "@/server/categories/kinds";
import { contactChannelsOf } from "@/server/listings/contact-channels";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  await connectDb();
  const record = (await Listing.findOne({ slug }).select("status expiresAt updatedAt seoNoindex ownerId slug").lean()) as {
    status?: string;
    expiresAt?: Date | null;
    updatedAt?: Date | null;
    seoNoindex?: boolean;
    ownerId?: unknown;
    slug?: string;
  } | null;
  const access = listingVisibility(record);
  const sample = await isSampleListing(record);
  if (access === "ended") {
    const paths = await getPaths();
    const endedPath = (await addressForSlug(slug)) || adPath(paths, slug);
    return withUrlSeo(endedPath, {
      title: "This ad is no longer available | Tharkoo",
      description: "This ad is no longer available on Tharkoo. See similar ads.",
      path: endedPath,
      index: false,
    }, adPath(paths, slug));
  }
  const [ad, site] = await Promise.all([getListingBySlug(slug), getSite()]);
  if (!ad) return {};
  const title = adPageTitle({ title: displayTitle(ad.title), city: prettyPlace(ad.citySlug), category: prettyPlace(ad.categorySlug), site: site.name });
  const description = adDescriptionFromText(ad.description, adMetaDescription({ title: displayTitle(ad.title), category: prettyPlace(ad.categorySlug), city: prettyPlace(ad.citySlug), site: site.name || "Tharkoo" }));
  const image = safePhoto(ad.photos?.[0]) || "/brand/og-default.png";
  const paths = await getPaths();
  const path = (await addressForSlug(ad.slug || slug)) || adPath(paths, ad.slug || slug);
  // H17.8: a sample (demo) ad page is always noindex,follow; a live real ad that is set to be indexed is indexable. H16.4: a people ad keeps its photos out of image search.
  const own = await Listing.findOne({ slug: ad.slug || slug }).select("_id").lean<{ _id: unknown } | null>();
  const people = own ? await listingIsPeople(String(own._id)) : false;
  const robots = adRobots({ access, indexed: record?.seoNoindex === false, sample, people });
  return withUrlSeo(path, { title, description, path, image, index: robots.index, noImageIndex: robots.noimageindex }, adPath(paths, ad.slug || slug));
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
  const record = (await Listing.findOne({ slug }).select("status expiresAt updatedAt").lean()) as {
    status?: string;
    expiresAt?: Date | null;
    updatedAt?: Date | null;
  } | null;
  const access = listingVisibility(record);
  if (access === "gone" || access === "missing") notFound();
  if (access === "ended") {
    const view = await loadEndedAd(slug);
    if (!view) notFound();
    return <AdEnded view={view} texts={await textOverrides()} />;
  }
  const ad = await getListingBySlug(slug);
  if (!ad) notFound();
  const row = (await Listing.findOne({ slug: ad.slug }).select("_id attributes publishedAt expiresAt ownerId code +contact").lean()) as {
    contact?: { phone?: string; whatsapp?: string };
    code?: string;
    _id?: unknown;
    ownerId?: unknown;
    attributes?: unknown;
    publishedAt?: Date;
    expiresAt?: Date;
  } | null;
  const listingId = row?._id ? String(row._id) : undefined;
  const [cat, related, videos, tourOffer, newDesign, peopleAd] = await Promise.all([
    getCategory(ad.categorySlug || ""),
    getRelated(ad, 12),
    listingId ? listAdVideos(listingId).catch(() => []) : Promise.resolve([]),
    listingId ? videoTourOffer(listingId) : Promise.resolve(null),
    newDesignOn(),
    // H7.5: a people category never shows the Call button. The same server check as the video tour rule.
    listingId ? listingIsPeople(listingId) : Promise.resolve(true),
  ]);
  const features = await kindFeatures((cat as { kind?: string } | null)?.kind);
  const tour = listingId && tourOffer ? { listingId, coins: tourOffer.coins } : null;
  const owner = row?.ownerId ? ((await User.findById(row.ownerId).select("displayName createdAt verificationStatus").lean()) as { displayName?: string; createdAt?: Date; verificationStatus?: string } | null) : null;
  const adView = { ...plain(ad), details: adDetailRows(row?.attributes, cat?.fields), interests: interestsOf(row?.attributes) };
  const cover = safePhoto(ad.photos?.[0]);
  const paths = await getPaths();
  const publicAd =
    row?.code && ad.categorySlug && ad.citySlug && ad.title
      ? adAddress({ categorySlug: ad.categorySlug, citySlug: ad.citySlug, title: ad.title, code: row.code })
      : adPath(paths, ad.slug || slug);
  const shareUrl = canonical(publicAd);
  const heading = await urlHeading(publicAd, displayTitle(ad.title) || "Listing", adPath(paths, ad.slug || slug));
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
    ...(district && !isCityAlias(city, district) ? [{ name: `${district} ${catName}`, path: placePath(ad.categorySlug || "", ad.citySlug || "", ad.districtSlug || "") }] : []),
  ];
  const seoSettings = await getSeoSettings().catch(() => null);
  // H17.5: the breadcrumb in the markup ends with the ad; a sample ad never claims an offer, product, job or rating.
  const structured = adJsonLdNodes({
    crumbs,
    title: displayTitle(ad.title) || "Listing",
    path: publicAd,
    sample: await isSampleListing({ ownerId: row?.ownerId, slug: ad.slug || slug }),
    listing: {
      mapping: seoSettings?.adSchema[ad.categorySlug || ""],
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
      people: peopleAd,
      verifiedPoster: owner?.verificationStatus === "approved",
    },
  });
  return (
    <>
      <JsonLd data={structured} />
      {newDesign ? (
        <NewAdDetail
          ad={adView}
          sellerName={publicSellerName(owner?.displayName)}
          priceUnit={cat?.fields?.find((field) => ["price", "rent", "salary"].includes(field.key))?.unit || ""}
          categoryName={catName}
          related={plain(related)}
          listingId={listingId}
          ownerId={row?.ownerId ? String(row.ownerId) : undefined}
          videos={videos}
          paths={paths}
          memberSince={owner?.createdAt ? new Date(owner.createdAt).toISOString() : ""}
          crumbs={crumbs}
          shareUrl={shareUrl}
          heading={heading}
          tour={tour}
          peopleAd={peopleAd}
          features={features}
          contactChannels={row ? contactChannelsOf(row.contact) : undefined}
          paymentsLive={coinProviderName() !== "mock"}
          alternatives={popupAlternatives(plain(ad), plain(related), paths)}
          texts={pickTexts(await textOverrides(), "ad.", "card.", "home.ads.")}
        />
      ) : (
        <AdDetail ad={adView} categoryName={catName} related={plain(related)} listingId={listingId} crumbs={crumbs} shareUrl={shareUrl} heading={heading} tour={tour} peopleAd={peopleAd} />
      )}
      <AdCountsBar slug={ad.slug || slug} category={ad.categorySlug} city={ad.citySlug} sample={Boolean(ad.sample)} />
      {newDesign ? null : <AdVideos videos={videos} title={displayTitle(ad.title) || "Listing"} />}
    </>
  );
}
